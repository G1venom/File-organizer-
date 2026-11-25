import React, { useRef, useState } from 'react';
import {
  Archive,
  Folder,
  FolderOpen,
  FolderPlus,
  Lock,
  Pin,
  Sparkles,
  Upload,
} from 'lucide-react';
import { FolderNode, VaultFile } from '../types/files';
import { supportsFileSystemAccess } from '../utils/fileSystem';
import { formatBytes, formatRelativeAge, getAgeInDays } from '../utils/formatters';

interface QuickAccessDashboardProps {
  files: VaultFile[];
  folders: FolderNode[];
  archiveAgeDays: number;
  isOrganizing: boolean;
  linkedDirName: string | null;
  onImportFiles: (fileList: FileList) => void;
  onConnectLocalFolder: () => void;
  onLoadSampleDesktop: () => void;
  onAutoOrganizeDesktop: () => void;
  onSelectFile: (file: VaultFile) => void;
  onSelectFolder: (folderName: string) => void;
  onArchiveOldFiles: () => void;
}

export const QuickAccessDashboard: React.FC<QuickAccessDashboardProps> = ({
  files,
  folders,
  archiveAgeDays,
  isOrganizing,
  linkedDirName,
  onImportFiles,
  onConnectLocalFolder,
  onLoadSampleDesktop,
  onAutoOrganizeDesktop,
  onSelectFile,
  onSelectFolder,
  onArchiveOldFiles,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const desktopFiles = files.filter((f) => f.status === 'desktop');
  const organizedFiles = files.filter((f) => f.status === 'organized');
  const archivedFiles = files.filter((f) => f.status === 'archived');
  const agingCandidates = files.filter(
    (f) => f.status !== 'archived' && getAgeInDays(f.modifiedAt) >= archiveAgeDays
  );
  const pinnedFiles = files.filter((f) => f.pinned && f.status !== 'archived');
  const recentFiles = files
    .filter((f) => f.status !== 'archived')
    .slice()
    .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
    .slice(0, 6);

  const foldersToCreate = Array.from(
    new Set(
      desktopFiles
        .map((f) => f.suggestedFolder)
        .filter((name) => !folders.some((folder) => folder.name === name))
    )
  );

  const canUseFS = supportsFileSystemAccess();

  return (
    <div className="space-y-8">
      {/* 4-Column Summary Strip */}
      <section aria-label="Workspace overview metrics">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="p-4 sm:p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Desktop Clutter
            </p>
            <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {desktopFiles.length}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {desktopFiles.length > 0 ? 'Waiting to organize' : 'Desktop clean'}
            </p>
          </div>

          <div className="p-4 sm:p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Organized Files
            </p>
            <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {organizedFiles.length}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              AES-256 encrypted locally
            </p>
          </div>

          <div className="p-4 sm:p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Designated Folders
            </p>
            <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {folders.length}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Auto-grouped by content
            </p>
          </div>

          <div className="p-4 sm:p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Cloud Archive
            </p>
            <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {archivedFiles.length}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {agingCandidates.length > 0
                ? `${agingCandidates.length} aging >${archiveAgeDays}d`
                : 'No aging backlog'}
            </p>
          </div>
        </div>
      </section>

      {/* Auto-Organize Action Banner when Desktop has unsorted files */}
      {desktopFiles.length > 0 && (
        <section
          aria-label="Desktop declutter action"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
        >
          <div className="space-y-1">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {desktopFiles.length} unsorted {desktopFiles.length === 1 ? 'file' : 'files'} on your desktop
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              DeskSort flagged each file by type and content. Moving them will organize into{' '}
              <span className="font-medium text-slate-900 dark:text-slate-200">
                {Array.from(new Set(desktopFiles.map((f) => f.suggestedFolder))).join(', ')}
              </span>
              {foldersToCreate.length > 0 ? ` (creating ${foldersToCreate.length} new folders).` : '.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onAutoOrganizeDesktop}
            disabled={isOrganizing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <FolderPlus className="h-4 w-4" />
            {isOrganizing ? 'Organizing...' : 'Auto-Organize Desktop'}
          </button>
        </section>
      )}

      {/* Dropzone & Local Computer Intake */}
      <section aria-label="Add or connect desktop files">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              onImportFiles(e.dataTransfer.files);
            }
          }}
          className={`rounded-xl border border-dashed p-6 transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30'
              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                {linkedDirName
                  ? `Linked Folder: ${linkedDirName}`
                  : 'Drop files from your computer to encrypt, tag, and organize'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Files are encrypted locally with AES-256-GCM before indexing. PDFs, documents, code, spreadsheets, and images are flagged automatically.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onImportFiles(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <Upload className="h-3.5 w-3.5" />
                Select Files
              </button>

              {canUseFS && (
                <button
                  type="button"
                  onClick={onConnectLocalFolder}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Link Desktop Folder
                </button>
              )}

              {files.length === 0 && (
                <button
                  type="button"
                  onClick={onLoadSampleDesktop}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Load Sample Messy Desktop
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Quick Access Grid: Pinned & Recent + Designated Folders */}
      {files.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Recent & Pinned Files */}
          <section
            aria-label="Pinned and recently accessed files"
            className="xl:col-span-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Quick Access Files
              </h2>
              <span className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                {pinnedFiles.length} pinned · {recentFiles.length} recent
              </span>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {(pinnedFiles.length > 0 ? [...pinnedFiles, ...recentFiles.filter((r) => !r.pinned)] : recentFiles)
                .slice(0, 7)
                .map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => onSelectFile(file)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {file.pinned && (
                          <Pin className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" aria-label="Pinned" />
                        )}
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {file.name}
                        </span>
                        {file.isSensitive && (
                          <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-label="Sensitive encrypted file" />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                        {file.folderName} · {file.categoryFlag} · {file.tags.slice(0, 3).join(', ')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono tabular-nums text-xs text-slate-700 dark:text-slate-300">
                        {formatBytes(file.size)}
                      </p>
                      <p className="font-mono tabular-nums text-[11px] text-slate-400 dark:text-slate-500">
                        {formatRelativeAge(file.modifiedAt)}
                      </p>
                    </div>
                  </button>
                ))}
            </div>
          </section>

          {/* Designated Folders & Aging Archive Prompt */}
          <div className="space-y-6">
            <section
              aria-label="Designated folders"
              className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                  Folders
                </h2>
                <span className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                  {folders.length}
                </span>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {folders.slice(0, 6).map((folder) => {
                  const count = files.filter(
                    (f) => f.folderName === folder.name && f.status === 'organized'
                  ).length;
                  return (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => onSelectFolder(folder.name)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Folder className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                          {folder.name}
                        </span>
                      </span>
                      <span className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400 shrink-0">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {agingCandidates.length > 0 && (
              <section
                aria-label="Old files eligible for cloud archive"
                className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Old Files Eligible for Archive
                  </h2>
                  <span className="font-mono tabular-nums text-xs text-amber-700 dark:text-amber-400">
                    {agingCandidates.length} files
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {agingCandidates.length} files haven’t been modified in over {archiveAgeDays} days. Archive their AES-256 encrypted payloads to cloud storage to free local clutter.
                </p>
                <button
                  type="button"
                  onClick={onArchiveOldFiles}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Archive className="h-3.5 w-3.5" />
                  Archive {agingCandidates.length} Old Files
                </button>
              </section>
            )}
          </div>
        </div>
      ) : (
        <section className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            Your Encrypted File Vault is Ready
          </h2>
          <p className="max-w-lg mx-auto text-sm text-slate-600 dark:text-slate-400">
            Select files from your computer, link your Desktop directory, or load a sample messy desktop to test automatic flagging, folder creation, semantic search, and cloud archiving.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onLoadSampleDesktop}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Load Sample Messy Desktop
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold transition-colors"
            >
              <Upload className="h-4 w-4" />
              Select Local Files
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
