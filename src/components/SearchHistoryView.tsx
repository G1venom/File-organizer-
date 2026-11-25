import React from 'react';
import { Clock, Pin, Search, Trash2 } from 'lucide-react';
import { SearchHistoryEntry } from '../types/files';
import { formatRelativeAge } from '../utils/formatters';

interface SearchHistoryViewProps {
  history: SearchHistoryEntry[];
  onRunQuery: (query: string, mode: 'keyword' | 'semantic') => void;
  onTogglePin: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onClearAll: () => void;
}

export const SearchHistoryView: React.FC<SearchHistoryViewProps> = ({
  history,
  onRunQuery,
  onTogglePin,
  onDeleteEntry,
  onClearAll,
}) => {
  const pinned = history.filter((h) => h.pinned);
  const recent = history.filter((h) => !h.pinned);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            Search History & Saved Queries
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Re-run keyword or natural-language semantic queries across your encrypted files and folders.
          </p>
        </div>
        {history.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear History
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 text-center space-y-2">
          <Clock className="h-6 w-6 text-slate-400 mx-auto" />
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            No search history recorded yet
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Use the search bar above to find files by keyword, tag, or natural-language description.
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
          {[...pinned, ...recent].map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <button
                type="button"
                onClick={() => onRunQuery(entry.query, entry.mode)}
                className="flex-1 text-left min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
              >
                <div className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {entry.query}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {entry.mode === 'semantic' ? 'Semantic Retrieval' : 'Keyword & Tag'} ·{' '}
                  {entry.engine === 'gemini' ? 'Gemini AI' : 'Local Vector Engine'} ·{' '}
                  <span className="font-mono tabular-nums">
                    {entry.matchedFileCount} files, {entry.matchedFolderCount} folders
                  </span>{' '}
                  · {formatRelativeAge(entry.timestamp)}
                </p>
              </button>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onTogglePin(entry.id)}
                  aria-label={entry.pinned ? 'Unpin query' : 'Pin query'}
                  className={`p-2 rounded-lg border text-xs transition-colors ${
                    entry.pinned
                      ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Pin className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteEntry(entry.id)}
                  aria-label="Delete search history entry"
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
