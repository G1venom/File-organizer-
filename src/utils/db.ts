import {
  FolderNode,
  SearchHistoryEntry,
  SyncQueueItem,
  VaultFile,
  WorkspaceSettings,
} from '../types/files';

const DB_NAME = 'desksort-vault-v1';
const DB_VERSION = 1;

const STORES = {
  FILES: 'files',
  FOLDERS: 'folders',
  HISTORY: 'searchHistory',
  SYNC: 'syncQueue',
  SETTINGS: 'settings',
} as const;

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  theme: 'light',
  strictLocalOnly: false,
  autoOrganizeOnImport: true,
  archiveAgeDays: 90,
  simulateOffline: false,
  hasPassphraseLock: false,
};

function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.FILES)) {
        db.createObjectStore(STORES.FILES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.FOLDERS)) {
        db.createObjectStore(STORES.FOLDERS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.HISTORY)) {
        db.createObjectStore(STORES.HISTORY, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.SYNC)) {
        db.createObjectStore(STORES.SYNC, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as T[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

async function putInStore<T>(storeName: string, value: T, key?: IDBValidKey): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = key !== undefined ? store.put(value, key) : store.put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function deleteFromStore(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function clearStore(storeName: string): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export const vaultDB = {
  async loadFiles(): Promise<VaultFile[]> {
    const items = await getAllFromStore<VaultFile>(STORES.FILES);
    return items.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
  },
  async saveFile(file: VaultFile): Promise<void> {
    await putInStore(STORES.FILES, file);
  },
  async saveFilesBatch(files: VaultFile[]): Promise<void> {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.FILES, 'readwrite');
      const store = tx.objectStore(STORES.FILES);
      for (const f of files) {
        store.put(f);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async deleteFile(id: string): Promise<void> {
    await deleteFromStore(STORES.FILES, id);
  },
  async loadFolders(): Promise<FolderNode[]> {
    const items = await getAllFromStore<FolderNode>(STORES.FOLDERS);
    return items.sort((a, b) => a.name.localeCompare(b.name));
  },
  async saveFolder(folder: FolderNode): Promise<void> {
    await putInStore(STORES.FOLDERS, folder);
  },
  async saveFoldersBatch(folders: FolderNode[]): Promise<void> {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.FOLDERS, 'readwrite');
      const store = tx.objectStore(STORES.FOLDERS);
      for (const f of folders) {
        store.put(f);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async loadSearchHistory(): Promise<SearchHistoryEntry[]> {
    const items = await getAllFromStore<SearchHistoryEntry>(STORES.HISTORY);
    return items.sort((a, b) => b.timestamp - a.timestamp);
  },
  async saveSearchHistoryEntry(entry: SearchHistoryEntry): Promise<void> {
    await putInStore(STORES.HISTORY, entry);
  },
  async deleteSearchHistoryEntry(id: string): Promise<void> {
    await deleteFromStore(STORES.HISTORY, id);
  },
  async clearSearchHistory(): Promise<void> {
    await clearStore(STORES.HISTORY);
  },
  async loadSyncQueue(): Promise<SyncQueueItem[]> {
    const items = await getAllFromStore<SyncQueueItem>(STORES.SYNC);
    return items.sort((a, b) => a.createdAt - b.createdAt);
  },
  async saveSyncQueueItem(item: SyncQueueItem): Promise<void> {
    await putInStore(STORES.SYNC, item);
  },
  async deleteSyncQueueItem(id: string): Promise<void> {
    await deleteFromStore(STORES.SYNC, id);
  },
  async loadSettings(): Promise<WorkspaceSettings> {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SETTINGS, 'readonly');
      const store = tx.objectStore(STORES.SETTINGS);
      const req = store.get('workspace');
      req.onsuccess = () => {
        resolve({ ...DEFAULT_SETTINGS, ...(req.result as Partial<WorkspaceSettings> | undefined) });
      };
      req.onerror = () => reject(req.error);
    });
  },
  async saveSettings(settings: WorkspaceSettings): Promise<void> {
    await putInStore(STORES.SETTINGS, settings, 'workspace');
  },
};
