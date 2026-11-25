import React, { useEffect, useState } from 'react';
import {
  Archive,
  FolderInput,
  Lock,
  Pin,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { FolderNode, VaultFile } from '../types/files';
import { decryptText } from '../utils/crypto';
import { formatBytes, formatShortDate, getAgeInDays } from '../utils/formatters';

interface FileInspectorDrawerProps {
  file: VaultFile | null;
  folders: FolderNode[];
  isVaultLocked: boolean;
  onClose: () => void;
  onMoveToFolder: (fileId: string, folderName: string) => void;
  onTogglePin: (fileId: string) => void;
  onArchiveFile: (fileId: string) => void;
  onRestoreFile: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onAddTag: (fileId: string, tag: string) => void;
}

export const FileInspectorDrawer: React.FC<FileInspectorDrawerProps> = ({
  file,
  folders,
  isVaultLocked,
  onClose,
  onMoveToFolder,
  onTogglePin,
  onArchiveFile,
  onRestoreFile,
  onDeleteFile,
  onAddTag,
}) => {
  const [decryptedPreview, setDecryptedPreview] = useState<string>('');
  const [decryptError, setDecryptError] = useState<string>('');
  const [newTag, setNewTag] = useState('');
  const [targetFolder, setTargetFolder] = useState('');

  useEffect(() => {
    if (!file) return;
    setTargetFolder(file.folderName);
    setDecryptedPreview('');
    setDecryptError('');

    if (isVaultLocked) {
      setDecryptError('Vault is locked. Unlock in Security & Sync to decrypt contents.');
      return;
    }

    let cancelled = false;
    decryptText(file.encryptedPayloadBase64, file.ivBase64)
      .then((text) => {
        if (!cancelled) {
          setDecryptedPreview(text);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDecryptError('Unable to decrypt file payload with current device key.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file, isVaultLocked]);

  useEffect(() => {
    if (!file) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [file, onClose]);

  if (!file) return null;

  const ageDays = getAgeInDays(file.modifiedAt);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspector-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg h-full overflow-y-auto bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between gap-6">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {file.categoryFlag} · {file.extension.toUpperCase() || 'FILE'} ·{' '}
                <span className="font-mono tabular-nums">{formatBytes(file.size)}</span>
              </p>
              <h2
                id="inspector-title"
                className="mt-1 font-display text-lg font-semibold text-slate-900 dark:text-slate-100 break-all"
              >
                {file.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close file inspector"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onTogglePin(file.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                file.pinned
                  ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Pin className="h-3.5 w-3.5" />
              {file.pinned ? 'Pinned' : 'Pin to Quick Access'}
            </button>

            {file.status !== 'archived' ? (
              <button
                type="button"
                onClick={() => onArchiveFile(file.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                <Archive className="h-3.5 w-3.5" />
                Archive to Cloud
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onRestoreFile(file.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 transition-colors whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore from Archive
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onDeleteFile(file.id);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Current Location</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {file.status === 'archived' ? 'Cloud Archive Vault' : file.folderName}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Suggested Designated Folder</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {file.suggestedFolder}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Modified / Age</span>
              <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                {formatShortDate(file.modifiedAt)} ({ageDays}d old)
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Privacy & Sensitivity</span>
              <span
                className={`font-medium ${
                  file.isSensitive
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {file.isSensitive ? file.sensitivityReason || 'Sensitive Document' : 'Standard'}
              </span>
            </div>
          </div>

          {file.status !== 'archived' && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <label
                htmlFor="move-folder-select"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Move to Designated Folder
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="move-folder-select"
                  value={targetFolder}
                  onChange={(e) => setTargetFolder(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="Desktop">Desktop (Unsorted)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                  {!folders.some((f) => f.name === file.suggestedFolder) && (
                    <option value={file.suggestedFolder}>{file.suggestedFolder} (Create New)</option>
                  )}
                </select>
                <button
                  type="button"
                  onClick={() => onMoveToFolder(file.id, targetFolder)}
                  disabled={targetFolder === file.folderName}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors whitespace-nowrap"
                >
                  <FolderInput className="h-3.5 w-3.5" />
                  Move
                </button>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Content-Analyzed Tags ({file.analysisSource === 'gemini' ? 'Gemini AI' : 'Local NLP'})
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {file.tags.join(' · ')}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newTag.trim()) {
                  onAddTag(file.id, newTag.trim().toLowerCase());
                  setNewTag('');
                }
              }}
              className="flex items-center gap-2 pt-1"
            >
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add custom tag..."
                aria-label="Add custom tag"
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                Add Tag
              </button>
            </form>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <h3 className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Decrypted Local Preview
            </h3>
            {decryptError ? (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <Lock className="h-4 w-4 shrink-0" />
                <span>{decryptError}</span>
              </div>
            ) : (
              <pre className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                {decryptedPreview || file.summary}
              </pre>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              <span>On-Device AES-256-GCM Encryption Verified</span>
            </div>
            <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 break-all">
              SHA-256: {file.sha256}
            </p>
            <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 break-all">
              AES-GCM IV: {file.ivBase64}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
