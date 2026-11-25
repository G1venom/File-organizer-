import React, { useState } from 'react';
import {
  Archive,
  Folder,
  FolderPlus,
  Lock,
  Pin,
  X,
} from 'lucide-react';
import { FolderNode, SemanticSearchOutput, VaultFile } from '../types/files';
import { formatBytes, formatShortDate, getAgeInDays } from '../utils/formatters';

interface FileExplorerViewProps {
  files: VaultFile[];
  folders: FolderNode[];
  selectedFolderFilter: string | null;
  searchResult: SemanticSearchOutput | null;
  onSelectFolderFilter: (folderName: string | null) => void;
  onClearSearch: () => void;
  onSelectFile: (file: VaultFile) => void;
  onAutoOrganizeDesktop: () => void;
  onCreateFolder: (name: string) => void;
  onArchiveFile: (fileId: string) => void;
}

type StatusFilter = 'all' | 'desktop' | 'organized' | 'sensitive';

export const FileExplorerView: React.FC<FileExplorerViewProps> = ({
  files,
  folders,
  selectedFolderFilter,
  searchResult,
  onSelectFolderFilter,
  onClearSearch,
  onSelectFile,
  onAutoOrganizeDesktop,
  onCreateFolder,
  onArchiveFile,
}) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderForm, setShowNewFolderForm] = useState(false);

  const activeFiles = files.filter((f) => f.status !== 'archived');

  let displayedFiles = activeFiles;
  if (selectedFolderFilter) {
    displayedFiles = displayedFiles.filter((f) => f.folderName === selectedFolderFilter);
  }
  if (statusFilter === 'desktop') {
    displayedFiles = displayedFiles.filter((f) => f.status === 'desktop');
  } else if (statusFilter === 'organized') {
    displayedFiles = displayedFiles.filter((f) => f.status === 'organized');
  } else if (statusFilter === 'sensitive') {
    displayedFiles = displayedFiles.filter((f) => f.isSensitive);
  }

  const desktopCount = activeFiles.filter((f) => f.status === 'desktop').length;

  return (
    <div className="space-y-6">
      {/* Semantic / Keyword Search Results View */}
      {searchResult && (
        <section
          aria-label="Search results"
          className="rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 p-5 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
                {searchResult.mode === 'semantic' ? 'Semantic Retrieval' : 'Keyword & Tag Search'} ·{' '}
                {searchResult.engine === 'gemini' ? 'Gemini AI' : 'Local Private Vector Engine'}
              </p>
              <h2 className="mt-0.5 font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Results for “{searchResult.query}”
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {searchResult.interpretation}
              </p>
            </div>
            <button
              type="button"
              onClick={onClearSearch}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <X className="h-3.5 w-3.5" />
              Clear Search
            </button>
          </div>

          {searchResult.matchedFolders.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Matching Folders ({searchResult.matchedFolders.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {searchResult.matchedFolders.map((m) => (
                  <button
                    key={m.folder.id}
                    type="button"
                    onClick={() => {
                      onClearSearch();
                      onSelectFolderFilter(m.folder.name);
                    }}
                    className="flex items-start justify-between gap-3 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left transition-colors"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Folder className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {m.folder.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {m.reason}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400 shrink-0">
                      {m.fileCount} files · {m.score}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Matching Files ({searchResult.matchedFiles.length})
            </h3>
            {searchResult.matchedFiles.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                No indexed files matched this description. Try broadening your query or switching between Semantic AI and Keyword search.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                {searchResult.matchedFiles.map((match) => (
                  <button
                    key={match.file.id}
                    type="button"
                    onClick={() => onSelectFile(match.file)}
                    className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {match.file.name}
                        </span>
                        {match.file.isSensitive && (
                          <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                        {match.file.folderName} · {match.reason} · {match.file.tags.slice(0, 4).join(', ')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono tabular-nums text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {match.score}% match
                      </p>
                      <p className="font-mono tabular-nums text-[11px] text-slate-400 dark:text-slate-500">
                        {formatBytes(match.file.size)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Toolbar: Segmented Filter Tabs & Folder Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Filter files by status"
            className="flex items-center p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800"
          >
            {(
              [
                { id: 'all', label: 'All Files' },
                { id: 'desktop', label: `Desktop (${desktopCount})` },
                { id: 'organized', label: 'Organized' },
                { id: 'sensitive', label: 'Sensitive' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {selectedFolderFilter && (
            <button
              type="button"
              onClick={() => onSelectFolderFilter(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <span>Folder: {selectedFolderFilter}</span>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {desktopCount > 0 && (
            <button
              type="button"
              onClick={onAutoOrganizeDesktop}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Declutter Desktop
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowNewFolderForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            New Folder
          </button>
        </div>
      </div>

      {showNewFolderForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newFolderName.trim()) {
              onCreateFolder(newFolderName.trim());
              setNewFolderName('');
              setShowNewFolderForm(false);
            }
          }}
          className="flex items-center gap-2 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
        >
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Enter new designated folder name..."
            aria-label="New folder name"
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap"
          >
            Create Folder
          </button>
        </form>
      )}

      {/* High-Density Accessible File Table */}
      <section
        aria-label="Files table"
        className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        {displayedFiles.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No files match this view. Try clearing the folder filter or importing new files.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">File Name & Content Tags</th>
                  <th className="py-3 px-4">Type Flag</th>
                  <th className="py-3 px-4">Folder</th>
                  <th className="py-3 px-4 text-right">Modified</th>
                  <th className="py-3 px-4 text-right">Size</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {displayedFiles.map((file) => {
                  const ageDays = getAgeInDays(file.modifiedAt);
                  return (
                    <tr
                      key={file.id}
                      onClick={() => onSelectFile(file)}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <td className="py-3 px-4 max-w-md">
                        <div className="flex items-center gap-2">
                          {file.pinned && (
                            <Pin className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                          )}
                          <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                            {file.name}
                          </span>
                          {file.isSensitive && (
                            <Lock
                              className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0"
                              aria-label="Encrypted sensitive file"
                            />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                          {file.tags.join(' · ')}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {file.categoryFlag}
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        <span
                          className={
                            file.status === 'desktop'
                              ? 'text-amber-700 dark:text-amber-400 font-medium'
                              : 'text-slate-700 dark:text-slate-300'
                          }
                        >
                          {file.folderName}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatShortDate(file.modifiedAt)} ({ageDays}d)
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatBytes(file.size)}
                      </td>
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => onArchiveFile(file.id)}
                          aria-label={`Archive ${file.name} to cloud`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Archive className="h-3 w-3" />
                          Archive
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
