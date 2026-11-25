import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Menu, Upload } from 'lucide-react';
import { CloudArchiveView } from './components/CloudArchiveView';
import { CommandSearchBar } from './components/CommandSearchBar';
import { FileExplorerView } from './components/FileExplorerView';
import { FileInspectorDrawer } from './components/FileInspectorDrawer';
import { QuickAccessDashboard } from './components/QuickAccessDashboard';
import { SearchHistoryView } from './components/SearchHistoryView';
import { SecuritySyncView } from './components/SecuritySyncView';
import { Sidebar } from './components/Sidebar';
import {
  ActiveNavView,
  FileCategoryFlag,
  FolderNode,
  SearchHistoryEntry,
  SemanticSearchOutput,
  SyncQueueItem,
  VaultFile,
  WorkspaceSettings,
} from './types/files';
import {
  encryptBytes,
  getKeyFingerprint,
  hashPassphrase,
} from './utils/crypto';
import { DEFAULT_SETTINGS, vaultDB } from './utils/db';
import {
  moveHandleToSubfolder,
  pickLocalDesktopDirectory,
} from './utils/fileSystem';
import { getAgeInDays } from './utils/formatters';
import {
  analyzeFileLocally,
  extractReadableText,
  redactSensitiveText,
  runLocalKeywordSearch,
  runLocalSemanticSearch,
} from './utils/localAnalyzer';
import { generateSampleDesktopFiles } from './utils/sampleDesktop';
import {
  getVectorIndexCount,
  queryLocalVectorStore,
  upsertVectorIndex,
  VectorRecord,
} from './utils/vectorIndex';

export default function App() {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  const [activeView, setActiveView] = useState<ActiveNavView>('quick-access');
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'keyword' | 'semantic'>('semantic');
  const [searchResult, setSearchResult] = useState<SemanticSearchOutput | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [browserOnline, setBrowserOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [isVaultLocked, setIsVaultLocked] = useState(false);
  const [keyFingerprint, setKeyFingerprint] = useState('INITIALIZING');
  const [vectorCount, setVectorCount] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [linkedDirHandle, setLinkedDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const localHandlesRef = useRef<Map<string, FileSystemFileHandle>>(new Map());
  const vectorMapRef = useRef<Map<string, VectorRecord>>(new Map());
  const headerUploadRef = useRef<HTMLInputElement>(null);

  const isOnline = browserOnline && !settings.simulateOffline;

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => {
      setToast((current) => (current === message ? null : current));
    }, 3600);
  }, []);

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  // Listen for browser online/offline events
  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Initial load from IndexedDB + sync cloud archive state if online
  useEffect(() => {
    let mounted = true;
    async function init() {
      const [loadedFiles, loadedFolders, loadedHistory, loadedQueue, loadedSettings, fp] =
        await Promise.all([
          vaultDB.loadFiles(),
          vaultDB.loadFolders(),
          vaultDB.loadSearchHistory(),
          vaultDB.loadSyncQueue(),
          vaultDB.loadSettings(),
          getKeyFingerprint(),
        ]);

      if (!mounted) return;
      setFiles(loadedFiles);
      setFolders(loadedFolders);
      setHistory(loadedHistory);
      setSyncQueue(loadedQueue);
      setSettings(loadedSettings);
      setIsVaultLocked(loadedSettings.hasPassphraseLock);
      setKeyFingerprint(fp);

      const vectors = await upsertVectorIndex(loadedFiles, loadedFolders);
      vectorMapRef.current = vectors;
      setVectorCount(await getVectorIndexCount());
      setIsLoaded(true);
    }
    init().catch(() => setIsLoaded(true));
    return () => {
      mounted = false;
    };
  }, []);

  const refreshVectors = useCallback(async (nextFiles: VaultFile[], nextFolders: FolderNode[]) => {
    const map = await upsertVectorIndex(nextFiles, nextFolders);
    vectorMapRef.current = map;
    setVectorCount(map.size);
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<WorkspaceSettings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      await vaultDB.saveSettings(next);
    },
    [settings]
  );

  // Sync queue processor (runs automatically when connectivity is restored)
  const processSyncQueue = useCallback(async () => {
    if (!isOnline || syncQueue.length === 0 || isSyncing) return;
    setIsSyncing(true);
    let syncedCount = 0;

    for (const item of syncQueue) {
      try {
        if (item.action === 'archive') {
          const target = files.find((f) => f.id === item.fileId);
          if (target) {
            const res = await fetch('/api/archive', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: target.id,
                name: target.name,
                extension: target.extension,
                mimeType: target.mimeType,
                size: target.size,
                categoryFlag: target.categoryFlag,
                folderName: target.suggestedFolder,
                tags: target.tags,
                isSensitive: target.isSensitive,
                summary: target.summary,
                sha256: target.sha256,
                ivBase64: target.ivBase64,
                encryptedPayloadBase64: target.encryptedPayloadBase64,
                originalCreatedAt: target.createdAt,
                archivedAt: target.archivedAt ?? Date.now(),
              }),
            });
            if (!res.ok) throw new Error('Cloud archive upload failed');
          }
        } else if (item.action === 'restore') {
          await fetch(`/api/archive/${encodeURIComponent(item.fileId)}`, {
            method: 'DELETE',
          });
        }
        await vaultDB.deleteSyncQueueItem(item.id);
        syncedCount++;
      } catch {
        // Keep in queue for next retry
      }
    }

    const remaining = await vaultDB.loadSyncQueue();
    setSyncQueue(remaining);
    setIsSyncing(false);
    if (syncedCount > 0) {
      showToast(`Synced ${syncedCount} queued cloud operation${syncedCount === 1 ? '' : 's'}.`);
    }
  }, [files, isOnline, isSyncing, showToast, syncQueue]);

  useEffect(() => {
    if (isOnline && syncQueue.length > 0) {
      processSyncQueue();
    }
  }, [isOnline, syncQueue.length, processSyncQueue]);

  const ensureFolderExists = useCallback(
    async (
      folderName: string,
      categoryFlag: FileCategoryFlag,
      currentFolders: FolderNode[]
    ): Promise<FolderNode[]> => {
      if (
        folderName === 'Desktop' ||
        currentFolders.some((f) => f.name.toLowerCase() === folderName.toLowerCase())
      ) {
        return currentFolders;
      }
      const nextFolder: FolderNode = {
        id: `folder-${Date.now()}-${folderName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name: folderName,
        description: `Auto-designated folder for ${categoryFlag} files`,
        categoryFlag,
        autoCreated: true,
        pinned: false,
        createdAt: Date.now(),
      };
      await vaultDB.saveFolder(nextFolder);
      return [...currentFolders, nextFolder].sort((a, b) => a.name.localeCompare(b.name));
    },
    []
  );

  // Import & encrypt real local files
  const handleImportFiles = useCallback(
    async (
      incoming: Array<{ file: File; handle?: FileSystemFileHandle }>
    ) => {
      if (incoming.length === 0) return;
      const newFiles: VaultFile[] = [];
      let nextFolders = [...folders];

      for (const item of incoming) {
        const { file, handle } = item;
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const ext = file.name.includes('.') ? file.name.split('.').pop() ?? '' : '';
        const extracted = extractReadableText(bytes, ext, file.type);

        // Encrypt locally on device using AES-256-GCM
        const encrypted = await encryptBytes(bytes.slice(0, 2_000_000));
        let analysis = analyzeFileLocally(file.name, ext, file.type, extracted);
        let analysisSource: 'local' | 'gemini' = 'local';

        // Optional AI-assisted semantic tagging when online & privacy mode permits
        if (isOnline && !settings.strictLocalOnly) {
          try {
            const res = await fetch('/api/ai/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileName: file.name,
                extension: ext,
                mimeType: file.type,
                excerpt: redactSensitiveText(extracted.slice(0, 1800)),
                existingFolders: nextFolders.map((f) => f.name),
              }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.analysis?.suggestedFolder) {
                analysis = {
                  categoryFlag: data.analysis.categoryFlag || analysis.categoryFlag,
                  suggestedFolder: data.analysis.suggestedFolder || analysis.suggestedFolder,
                  tags: Array.isArray(data.analysis.tags) ? data.analysis.tags : analysis.tags,
                  isSensitive: Boolean(data.analysis.isSensitive),
                  sensitivityReason: data.analysis.sensitivityReason || analysis.sensitivityReason,
                  summary: data.analysis.summary || analysis.summary,
                };
                analysisSource = 'gemini';
              }
            }
          } catch {
            // Fallback seamlessly to local analyzer
          }
        }

        const id = `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        if (handle) {
          localHandlesRef.current.set(id, handle);
        }

        const autoOrganized = settings.autoOrganizeOnImport;
        const targetFolder = autoOrganized ? analysis.suggestedFolder : 'Desktop';

        if (autoOrganized) {
          nextFolders = await ensureFolderExists(
            analysis.suggestedFolder,
            analysis.categoryFlag,
            nextFolders
          );
          if (linkedDirHandle && handle) {
            await moveHandleToSubfolder(linkedDirHandle, handle, analysis.suggestedFolder);
          }
        }

        newFiles.push({
          id,
          name: file.name,
          extension: ext.toLowerCase(),
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          categoryFlag: analysis.categoryFlag,
          folderName: targetFolder,
          suggestedFolder: analysis.suggestedFolder,
          status: autoOrganized ? 'organized' : 'desktop',
          tags: analysis.tags,
          isSensitive: analysis.isSensitive,
          sensitivityReason: analysis.sensitivityReason,
          summary: analysis.summary,
          pinned: false,
          createdAt: file.lastModified || Date.now(),
          modifiedAt: file.lastModified || Date.now(),
          lastAccessedAt: Date.now(),
          organizedAt: autoOrganized ? Date.now() : undefined,
          sha256: encrypted.sha256,
          ivBase64: encrypted.ivBase64,
          encryptedPayloadBase64: encrypted.encryptedPayloadBase64,
          hasLocalHandle: Boolean(handle),
          analysisSource,
        });
      }

      const combinedFiles = [...newFiles, ...files];
      await vaultDB.saveFilesBatch(newFiles);
      setFiles(combinedFiles);
      setFolders(nextFolders);
      await refreshVectors(combinedFiles, nextFolders);

      showToast(
        `Encrypted and indexed ${newFiles.length} file${newFiles.length === 1 ? '' : 's'}.`
      );
    },
    [ensureFolderExists, files, folders, isOnline, linkedDirHandle, refreshVectors, settings.autoOrganizeOnImport, settings.strictLocalOnly, showToast]
  );

  const handleConnectLocalFolder = useCallback(async () => {
    try {
      const picked = await pickLocalDesktopDirectory();
      if (!picked) return;
      setLinkedDirHandle(picked.dirHandle);
      await handleImportFiles(
        picked.entries.map((entry) => ({ file: entry.file, handle: entry.handle }))
      );
    } catch {
      showToast('Folder access was cancelled or unavailable in this browser.');
    }
  }, [handleImportFiles, showToast]);

  const handleLoadSampleDesktop = useCallback(async () => {
    const sample = await generateSampleDesktopFiles();
    const existingIds = new Set(files.map((f) => f.id));
    const freshFiles = sample.files.filter((f) => !existingIds.has(f.id));

    let nextFolders = [...folders];
    for (const folder of sample.folders) {
      nextFolders = await ensureFolderExists(folder.name, folder.categoryFlag, nextFolders);
    }

    const nextFiles = [...freshFiles, ...files];
    await vaultDB.saveFilesBatch(freshFiles);
    setFiles(nextFiles);
    setFolders(nextFolders);
    await refreshVectors(nextFiles, nextFolders);
    showToast(`Loaded ${freshFiles.length} messy desktop files ready to declutter.`);
  }, [ensureFolderExists, files, folders, refreshVectors, showToast]);

  const handleAutoOrganizeDesktop = useCallback(async () => {
    const desktopItems = files.filter((f) => f.status === 'desktop');
    if (desktopItems.length === 0) return;

    setIsOrganizing(true);
    let nextFolders = [...folders];
    const updatedFiles: VaultFile[] = [];

    for (const file of files) {
      if (file.status === 'desktop') {
        nextFolders = await ensureFolderExists(
          file.suggestedFolder,
          file.categoryFlag,
          nextFolders
        );
        const handle = localHandlesRef.current.get(file.id);
        if (linkedDirHandle && handle) {
          await moveHandleToSubfolder(linkedDirHandle, handle, file.suggestedFolder);
        }
        updatedFiles.push({
          ...file,
          folderName: file.suggestedFolder,
          status: 'organized',
          organizedAt: Date.now(),
        });
      } else {
        updatedFiles.push(file);
      }
    }

    await vaultDB.saveFilesBatch(updatedFiles);
    setFiles(updatedFiles);
    setFolders(nextFolders);
    await refreshVectors(updatedFiles, nextFolders);
    setIsOrganizing(false);
    showToast(`Organized ${desktopItems.length} desktop files into designated folders.`);
  }, [ensureFolderExists, files, folders, linkedDirHandle, refreshVectors, showToast]);

  const handleMoveToFolder = useCallback(
    async (fileId: string, folderName: string) => {
      const target = files.find((f) => f.id === fileId);
      if (!target) return;

      const nextFolders = await ensureFolderExists(folderName, target.categoryFlag, folders);
      const handle = localHandlesRef.current.get(fileId);
      if (linkedDirHandle && handle && folderName !== 'Desktop') {
        await moveHandleToSubfolder(linkedDirHandle, handle, folderName);
      }

      const updated: VaultFile = {
        ...target,
        folderName,
        status: folderName === 'Desktop' ? 'desktop' : 'organized',
        organizedAt: folderName === 'Desktop' ? undefined : Date.now(),
      };

      const nextFiles = files.map((f) => (f.id === fileId ? updated : f));
      await vaultDB.saveFile(updated);
      setFiles(nextFiles);
      setFolders(nextFolders);
      setSelectedFile(updated);
      await refreshVectors(nextFiles, nextFolders);
      showToast(`Moved "${target.name}" to ${folderName}.`);
    },
    [ensureFolderExists, files, folders, linkedDirHandle, refreshVectors, showToast]
  );

  const handleTogglePinFile = useCallback(
    async (fileId: string) => {
      const target = files.find((f) => f.id === fileId);
      if (!target) return;
      const updated = { ...target, pinned: !target.pinned };
      await vaultDB.saveFile(updated);
      setFiles((prev) => prev.map((f) => (f.id === fileId ? updated : f)));
      setSelectedFile((curr) => (curr?.id === fileId ? updated : curr));
    },
    [files]
  );

  const handleAddTag = useCallback(
    async (fileId: string, tag: string) => {
      const target = files.find((f) => f.id === fileId);
      if (!target || target.tags.includes(tag)) return;
      const updated = { ...target, tags: [...target.tags, tag] };
      const nextFiles = files.map((f) => (f.id === fileId ? updated : f));
      await vaultDB.saveFile(updated);
      setFiles(nextFiles);
      setSelectedFile((curr) => (curr?.id === fileId ? updated : curr));
      await refreshVectors(nextFiles, folders);
    },
    [files, folders, refreshVectors]
  );

  const handleArchiveFile = useCallback(
    async (fileId: string) => {
      const target = files.find((f) => f.id === fileId);
      if (!target) return;

      const updated: VaultFile = {
        ...target,
        status: 'archived',
        archivedAt: Date.now(),
      };
      await vaultDB.saveFile(updated);
      const nextFiles = files.map((f) => (f.id === fileId ? updated : f));
      setFiles(nextFiles);
      if (selectedFile?.id === fileId) setSelectedFile(updated);

      if (isOnline) {
        try {
          const res = await fetch('/api/archive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: updated.id,
              name: updated.name,
              extension: updated.extension,
              mimeType: updated.mimeType,
              size: updated.size,
              categoryFlag: updated.categoryFlag,
              folderName: updated.suggestedFolder,
              tags: updated.tags,
              isSensitive: updated.isSensitive,
              summary: updated.summary,
              sha256: updated.sha256,
              ivBase64: updated.ivBase64,
              encryptedPayloadBase64: updated.encryptedPayloadBase64,
              originalCreatedAt: updated.createdAt,
              archivedAt: updated.archivedAt,
            }),
          });
          if (!res.ok) throw new Error('Upload failed');
          showToast(`Encrypted & archived "${updated.name}" to cloud storage.`);
          return;
        } catch {
          // Queue offline below
        }
      }

      const qItem: SyncQueueItem = {
        id: `sync-${Date.now()}-${fileId}`,
        action: 'archive',
        fileId: updated.id,
        fileName: updated.name,
        createdAt: Date.now(),
        status: 'pending',
      };
      await vaultDB.saveSyncQueueItem(qItem);
      setSyncQueue((prev) => [...prev, qItem]);
      showToast(`Queued "${updated.name}" for cloud archive when online.`);
    },
    [files, isOnline, selectedFile?.id, showToast]
  );

  const handleArchiveOldFiles = useCallback(async () => {
    const candidates = files.filter(
      (f) => f.status !== 'archived' && getAgeInDays(f.modifiedAt) >= settings.archiveAgeDays
    );
    for (const file of candidates) {
      await handleArchiveFile(file.id);
    }
  }, [files, handleArchiveFile, settings.archiveAgeDays]);

  const handleRestoreFile = useCallback(
    async (fileId: string) => {
      const target = files.find((f) => f.id === fileId);
      if (!target) return;

      const updated: VaultFile = {
        ...target,
        status: 'organized',
        folderName: target.suggestedFolder,
        archivedAt: undefined,
      };
      const nextFolders = await ensureFolderExists(
        target.suggestedFolder,
        target.categoryFlag,
        folders
      );
      await vaultDB.saveFile(updated);
      setFiles((prev) => prev.map((f) => (f.id === fileId ? updated : f)));
      setFolders(nextFolders);
      if (selectedFile?.id === fileId) setSelectedFile(updated);

      if (isOnline) {
        try {
          await fetch(`/api/archive/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
          showToast(`Restored "${updated.name}" to ${updated.folderName}.`);
          return;
        } catch {
          // Queue offline restore
        }
      }

      const qItem: SyncQueueItem = {
        id: `sync-restore-${Date.now()}-${fileId}`,
        action: 'restore',
        fileId: updated.id,
        fileName: updated.name,
        createdAt: Date.now(),
        status: 'pending',
      };
      await vaultDB.saveSyncQueueItem(qItem);
      setSyncQueue((prev) => [...prev, qItem]);
      showToast(`Restored locally; cloud cleanup queued until online.`);
    },
    [ensureFolderExists, files, folders, isOnline, selectedFile?.id, showToast]
  );

  const handleDeleteFile = useCallback(
    async (fileId: string) => {
      await vaultDB.deleteFile(fileId);
      const nextFiles = files.filter((f) => f.id !== fileId);
      setFiles(nextFiles);
      await refreshVectors(nextFiles, folders);
      showToast('File removed from local encrypted vault.');
    },
    [files, folders, refreshVectors, showToast]
  );

  const handleCreateFolder = useCallback(
    async (name: string) => {
      const nextFolders = await ensureFolderExists(name, 'Document', folders);
      setFolders(nextFolders);
      await refreshVectors(files, nextFolders);
      showToast(`Created designated folder "${name}".`);
    },
    [ensureFolderExists, files, folders, refreshVectors, showToast]
  );

  // Hybrid Semantic + Local Vector Search
  const executeSearch = useCallback(
    async (queryOverride?: string, modeOverride?: 'keyword' | 'semantic') => {
      const q = (queryOverride ?? searchQuery).trim();
      const mode = modeOverride ?? searchMode;
      if (!q) {
        setSearchResult(null);
        return;
      }

      setIsSearching(true);
      setActiveView('explorer');
      setSelectedFolderFilter(null);

      let output: SemanticSearchOutput;
      if (mode === 'keyword') {
        output = runLocalKeywordSearch(q, files, folders);
      } else {
        // Combine local semantic concept engine + local 192-dim vector cosine similarity
        const localConcept = runLocalSemanticSearch(q, files, folders);
        const vectorHits = queryLocalVectorStore(q, files, folders, vectorMapRef.current);

        const mergedFileMap = new Map<string, { file: VaultFile; score: number; reason: string }>();
        for (const m of localConcept.matchedFiles) {
          mergedFileMap.set(m.file.id, m);
        }
        for (const v of vectorHits.files) {
          const existing = mergedFileMap.get(v.file.id);
          if (existing) {
            existing.score = Math.min(99, Math.round((existing.score + v.score) / 2) + 8);
          } else if (v.score >= 32) {
            mergedFileMap.set(v.file.id, v);
          }
        }

        const mergedFolderMap = new Map<string, typeof localConcept.matchedFolders[number]>();
        for (const f of localConcept.matchedFolders) {
          mergedFolderMap.set(f.folder.name, f);
        }
        for (const vf of vectorHits.folders) {
          if (!mergedFolderMap.has(vf.folder.name) && vf.score >= 34) {
            mergedFolderMap.set(vf.folder.name, vf);
          }
        }

        output = {
          ...localConcept,
          matchedFiles: Array.from(mergedFileMap.values()).sort((a, b) => b.score - a.score),
          matchedFolders: Array.from(mergedFolderMap.values()).sort((a, b) => b.score - a.score),
        };

        // Enhance with Gemini semantic search when online & Strict Local-Only is OFF
        if (isOnline && !settings.strictLocalOnly && files.length > 0) {
          try {
            const res = await fetch('/api/ai/semantic-search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: q,
                folders: folders.map((folder) => ({
                  name: folder.name,
                  description: folder.description,
                  fileCount: files.filter((f) => f.folderName === folder.name).length,
                })),
                files: files.map((file) => ({
                  id: file.id,
                  name: file.name,
                  extension: file.extension,
                  categoryFlag: file.categoryFlag,
                  folderName: file.folderName,
                  tags: file.tags,
                  summary: file.summary,
                  status: file.status,
                })),
              }),
            });

            if (res.ok) {
              const data = await res.json();
              const aiResult = data.result;
              if (aiResult && Array.isArray(aiResult.matchedFiles)) {
                const fileById = new Map(files.map((f) => [f.id, f]));
                const folderByName = new Map(folders.map((f) => [f.name, f]));

                const aiMatchedFiles = aiResult.matchedFiles
                  .map((item: { id: string; score: number; reason: string }) => {
                    const f = fileById.get(item.id);
                    return f ? { file: f, score: Math.round(item.score), reason: item.reason } : null;
                  })
                  .filter(Boolean);

                const aiMatchedFolders = Array.isArray(aiResult.matchedFolders)
                  ? aiResult.matchedFolders
                      .map((item: { name: string; score: number; reason: string }) => {
                        const folder = folderByName.get(item.name);
                        return folder
                          ? {
                              folder,
                              fileCount: files.filter(
                                (f) => f.folderName === folder.name && f.status !== 'archived'
                              ).length,
                              score: Math.round(item.score),
                              reason: item.reason,
                            }
                          : null;
                      })
                      .filter(Boolean)
                  : [];

                if (aiMatchedFiles.length > 0 || aiMatchedFolders.length > 0) {
                  output = {
                    query: q,
                    mode: 'semantic',
                    engine: 'gemini',
                    interpretation: aiResult.interpretation || output.interpretation,
                    matchedFiles: aiMatchedFiles,
                    matchedFolders: aiMatchedFolders,
                  };
                }
              }
            }
          } catch {
            // Keep local vector results on error
          }
        }
      }

      setSearchResult(output);
      setIsSearching(false);

      const entry: SearchHistoryEntry = {
        id: `hist-${Date.now()}`,
        query: q,
        mode,
        matchedFileCount: output.matchedFiles.length,
        matchedFolderCount: output.matchedFolders.length,
        timestamp: Date.now(),
        pinned: false,
        engine: output.engine,
      };
      await vaultDB.saveSearchHistoryEntry(entry);
      setHistory((prev) => [entry, ...prev.filter((h) => h.query !== q)].slice(0, 50));
    },
    [files, folders, isOnline, searchMode, searchQuery, settings.strictLocalOnly]
  );

  const viewTitleMap: Record<ActiveNavView, string> = {
    'quick-access': 'Quick Access Dashboard',
    explorer: selectedFolderFilter ? `Folders / ${selectedFolderFilter}` : 'Desktop & Folders',
    'search-history': 'Search History',
    'cloud-archive': 'Cloud Archive',
    'security-sync': 'Security & Offline Sync',
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-sm">
        Unlocking encrypted local vault...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        folders={folders}
        files={files}
        selectedFolderFilter={selectedFolderFilter}
        onSelectFolder={setSelectedFolderFilter}
        theme={settings.theme}
        onToggleTheme={() =>
          updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
        }
        isOnline={isOnline}
        strictLocalOnly={settings.strictLocalOnly}
        pendingSyncCount={syncQueue.length}
        isSyncing={isSyncing}
        onSyncNow={processSyncQueue}
        isLocked={isVaultLocked}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean Single-Row Top Header */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-6 py-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
              {viewTitleMap[activeView]}
            </h1>
          </div>

          <div className="shrink-0">
            <input
              ref={headerUploadRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  const arr = Array.from(e.target.files).map((file) => ({ file }));
                  handleImportFiles(arr);
                  e.target.value = '';
                }
              }}
            />
            <button
              type="button"
              onClick={() => headerUploadRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Upload className="h-3.5 w-3.5" />
              Add Files
            </button>
          </div>
        </header>

        <main className="flex-1 px-6 py-6 max-w-6xl w-full mx-auto space-y-6">
          <CommandSearchBar
            query={searchQuery}
            mode={searchMode}
            isSearching={isSearching}
            recentHistory={history}
            onQueryChange={setSearchQuery}
            onModeChange={setSearchMode}
            onSubmitSearch={executeSearch}
            onClearSearch={() => {
              setSearchQuery('');
              setSearchResult(null);
            }}
          />

          {activeView === 'quick-access' && (
            <QuickAccessDashboard
              files={files}
              folders={folders}
              archiveAgeDays={settings.archiveAgeDays}
              isOrganizing={isOrganizing}
              linkedDirName={linkedDirHandle?.name ?? null}
              onImportFiles={(list) =>
                handleImportFiles(Array.from(list).map((file) => ({ file })))
              }
              onConnectLocalFolder={handleConnectLocalFolder}
              onLoadSampleDesktop={handleLoadSampleDesktop}
              onAutoOrganizeDesktop={handleAutoOrganizeDesktop}
              onSelectFile={(file) => {
                setSelectedFile(file);
                const updated = { ...file, lastAccessedAt: Date.now() };
                vaultDB.saveFile(updated);
                setFiles((prev) => prev.map((f) => (f.id === file.id ? updated : f)));
              }}
              onSelectFolder={(folderName) => {
                setSelectedFolderFilter(folderName);
                setActiveView('explorer');
              }}
              onArchiveOldFiles={handleArchiveOldFiles}
            />
          )}

          {activeView === 'explorer' && (
            <FileExplorerView
              files={files}
              folders={folders}
              selectedFolderFilter={selectedFolderFilter}
              searchResult={searchResult}
              onSelectFolderFilter={setSelectedFolderFilter}
              onClearSearch={() => {
                setSearchQuery('');
                setSearchResult(null);
              }}
              onSelectFile={(file) => {
                setSelectedFile(file);
                const updated = { ...file, lastAccessedAt: Date.now() };
                vaultDB.saveFile(updated);
                setFiles((prev) => prev.map((f) => (f.id === file.id ? updated : f)));
              }}
              onAutoOrganizeDesktop={handleAutoOrganizeDesktop}
              onCreateFolder={handleCreateFolder}
              onArchiveFile={handleArchiveFile}
            />
          )}

          {activeView === 'search-history' && (
            <SearchHistoryView
              history={history}
              onRunQuery={(q, mode) => {
                setSearchQuery(q);
                setSearchMode(mode);
                executeSearch(q, mode);
              }}
              onTogglePin={async (id) => {
                const target = history.find((h) => h.id === id);
                if (!target) return;
                const updated = { ...target, pinned: !target.pinned };
                await vaultDB.saveSearchHistoryEntry(updated);
                setHistory((prev) => prev.map((h) => (h.id === id ? updated : h)));
              }}
              onDeleteEntry={async (id) => {
                await vaultDB.deleteSearchHistoryEntry(id);
                setHistory((prev) => prev.filter((h) => h.id !== id));
              }}
              onClearAll={async () => {
                await vaultDB.clearSearchHistory();
                setHistory([]);
              }}
            />
          )}

          {activeView === 'cloud-archive' && (
            <CloudArchiveView
              files={files}
              archiveAgeDays={settings.archiveAgeDays}
              isOnline={isOnline}
              syncQueue={syncQueue}
              onChangeArchiveAgeDays={(days) => updateSettings({ archiveAgeDays: days })}
              onArchiveOldFiles={handleArchiveOldFiles}
              onArchiveFile={handleArchiveFile}
              onRestoreFile={handleRestoreFile}
              onSyncNow={processSyncQueue}
            />
          )}

          {activeView === 'security-sync' && (
            <SecuritySyncView
              settings={settings}
              keyFingerprint={keyFingerprint}
              vectorCount={vectorCount}
              isVaultLocked={isVaultLocked}
              isOnline={isOnline}
              syncQueue={syncQueue}
              isSyncing={isSyncing}
              onUpdateSettings={updateSettings}
              onSetPassphrase={async (passphrase) => {
                const verifier = await hashPassphrase(passphrase);
                await updateSettings({ hasPassphraseLock: true, passphraseVerifier: verifier });
                setIsVaultLocked(true);
              }}
              onUnlockVault={async (passphrase) => {
                const verifier = await hashPassphrase(passphrase);
                if (verifier === settings.passphraseVerifier) {
                  setIsVaultLocked(false);
                  return true;
                }
                return false;
              }}
              onLockVault={() => setIsVaultLocked(true)}
              onSyncNow={processSyncQueue}
              onRebuildVectors={async () => {
                await refreshVectors(files, folders);
                showToast('Rebuilt local vector embeddings index.');
              }}
            />
          )}
        </main>
      </div>

      <FileInspectorDrawer
        file={selectedFile}
        folders={folders}
        isVaultLocked={isVaultLocked}
        onClose={() => setSelectedFile(null)}
        onMoveToFolder={handleMoveToFolder}
        onTogglePin={handleTogglePinFile}
        onArchiveFile={handleArchiveFile}
        onRestoreFile={handleRestoreFile}
        onDeleteFile={handleDeleteFile}
        onAddTag={handleAddTag}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
