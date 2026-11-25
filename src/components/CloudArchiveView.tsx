import React from 'react';
import { Archive, Cloud, RefreshCw, RotateCcw, WifiOff } from 'lucide-react';
import { SyncQueueItem, VaultFile } from '../types/files';
import { formatBytes, formatShortDate, getAgeInDays } from '../utils/formatters';

interface CloudArchiveViewProps {
  files: VaultFile[];
  archiveAgeDays: number;
  isOnline: boolean;
  syncQueue: SyncQueueItem[];
  onChangeArchiveAgeDays: (days: number) => void;
  onArchiveOldFiles: () => void;
  onArchiveFile: (fileId: string) => void;
  onRestoreFile: (fileId: string) => void;
  onSyncNow: () => void;
}

export const CloudArchiveView: React.FC<CloudArchiveViewProps> = ({
  files,
  archiveAgeDays,
  isOnline,
  syncQueue,
  onChangeArchiveAgeDays,
  onArchiveOldFiles,
  onArchiveFile,
  onRestoreFile,
  onSyncNow,
}) => {
  const archivedFiles = files.filter((f) => f.status === 'archived');
  const agingCandidates = files.filter(
    (f) => f.status !== 'archived' && getAgeInDays(f.modifiedAt) >= archiveAgeDays
  );
  const pendingArchiveOps = syncQueue.filter(
    (item) => item.action === 'archive' || item.action === 'restore'
  );

  const archivedBytes = archivedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            Zero-Knowledge Cloud Archive
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Offload aging files to cloud storage while keeping AES-256-GCM encryption keys strictly on your device.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label
            htmlFor="archive-age-select"
            className="text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            Aging threshold:
          </label>
          <select
            id="archive-age-select"
            value={archiveAgeDays}
            onChange={(e) => onChangeArchiveAgeDays(Number(e.target.value))}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
          </select>
        </div>
      </div>

      {!isOnline && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
          <span className="flex items-center gap-2">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>
              You are currently offline. Archive and restore requests are saved to your local sync queue and will upload automatically once connectivity returns.
            </span>
          </span>
        </div>
      )}

      {pendingArchiveOps.length > 0 && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900">
          <div className="text-xs text-slate-700 dark:text-slate-300">
            <span className="font-semibold">{pendingArchiveOps.length} cloud sync operations queued</span>{' '}
            ({pendingArchiveOps.map((p) => p.fileName).join(', ')})
          </div>
          {isOnline && (
            <button
              type="button"
              onClick={onSyncNow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sync Now
            </button>
          )}
        </div>
      )}

      {/* Aging Files Eligible for Archiving */}
      <section
        aria-label="Aging files eligible for cloud archive"
        className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Aging Files ({agingCandidates.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Files unmodified for at least {archiveAgeDays} days.
            </p>
          </div>
          {agingCandidates.length > 0 && (
            <button
              type="button"
              onClick={onArchiveOldFiles}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Archive className="h-3.5 w-3.5" />
              Archive All {agingCandidates.length} Old Files
            </button>
          )}
        </div>

        {agingCandidates.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
            No local files exceed the {archiveAgeDays}-day threshold.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {agingCandidates.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {file.folderName} · {formatShortDate(file.modifiedAt)} ·{' '}
                    <span className="font-mono tabular-nums">{getAgeInDays(file.modifiedAt)}d old</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono tabular-nums text-xs text-slate-600 dark:text-slate-400">
                    {formatBytes(file.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onArchiveFile(file.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Archive
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Archived Files Stored in Cloud */}
      <section
        aria-label="Files stored in cloud archive"
        className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Archived in Cloud Storage ({archivedFiles.length})
            </h3>
          </div>
          <span className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
            {formatBytes(archivedBytes)} offloaded
          </span>
        </div>

        {archivedFiles.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No files have been archived to cloud storage yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {archivedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    Original folder: {file.suggestedFolder} · AES-256 Encrypted · Archived{' '}
                    {file.archivedAt ? formatShortDate(file.archivedAt) : 'Synced'}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono tabular-nums text-xs text-slate-600 dark:text-slate-400">
                    {formatBytes(file.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRestoreFile(file.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
