export type FileCategoryFlag =
  | 'Exam & Academic'
  | 'Financial'
  | 'Legal & ID'
  | 'Code & Script'
  | 'Spreadsheet'
  | 'Presentation'
  | 'Image & Media'
  | 'Archive'
  | 'Notes'
  | 'Document';

export type FileStatus = 'desktop' | 'organized' | 'archived';

export interface VaultFile {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  size: number;
  categoryFlag: FileCategoryFlag;
  folderName: string;
  suggestedFolder: string;
  status: FileStatus;
  tags: string[];
  isSensitive: boolean;
  sensitivityReason: string;
  summary: string;
  pinned: boolean;
  createdAt: number;
  modifiedAt: number;
  lastAccessedAt: number;
  organizedAt?: number;
  archivedAt?: number;
  sha256: string;
  ivBase64: string;
  encryptedPayloadBase64: string;
  hasLocalHandle?: boolean;
  analysisSource: 'local' | 'gemini';
}

export interface FolderNode {
  id: string;
  name: string;
  description: string;
  categoryFlag: FileCategoryFlag;
  autoCreated: boolean;
  pinned: boolean;
  createdAt: number;
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  mode: 'keyword' | 'semantic';
  matchedFileCount: number;
  matchedFolderCount: number;
  timestamp: number;
  pinned: boolean;
  engine: 'local' | 'gemini';
}

export interface SyncQueueItem {
  id: string;
  action: 'archive' | 'restore' | 'ai-analyze';
  fileId: string;
  fileName: string;
  createdAt: number;
  status: 'pending' | 'syncing' | 'failed';
  errorMessage?: string;
}

export interface WorkspaceSettings {
  theme: 'light' | 'dark';
  strictLocalOnly: boolean;
  autoOrganizeOnImport: boolean;
  archiveAgeDays: number;
  simulateOffline: boolean;
  hasPassphraseLock: boolean;
  passphraseVerifier?: string;
}

export interface SemanticFileMatch {
  file: VaultFile;
  score: number;
  reason: string;
}

export interface SemanticFolderMatch {
  folder: FolderNode;
  fileCount: number;
  score: number;
  reason: string;
}

export interface SemanticSearchOutput {
  query: string;
  mode: 'keyword' | 'semantic';
  engine: 'local' | 'gemini';
  interpretation: string;
  matchedFiles: SemanticFileMatch[];
  matchedFolders: SemanticFolderMatch[];
}

export type ActiveNavView =
  | 'quick-access'
  | 'explorer'
  | 'search-history'
  | 'cloud-archive'
  | 'security-sync';
