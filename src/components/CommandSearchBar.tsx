import React, { useEffect, useRef, useState } from 'react';
import { Clock, Search, X } from 'lucide-react';
import { SearchHistoryEntry } from '../types/files';

interface CommandSearchBarProps {
  query: string;
  mode: 'keyword' | 'semantic';
  isSearching: boolean;
  recentHistory: SearchHistoryEntry[];
  onQueryChange: (q: string) => void;
  onModeChange: (mode: 'keyword' | 'semantic') => void;
  onSubmitSearch: (queryOverride?: string, modeOverride?: 'keyword' | 'semantic') => void;
  onClearSearch: () => void;
}

const EXAMPLE_SEMANTIC_QUERIES = [
  'My students exams paper pdfs or the folder',
  'Tax returns and consulting invoices from 2024 or 2025',
  'Signed legal agreements and confidential contracts',
];

export const CommandSearchBar: React.FC<CommandSearchBarProps> = ({
  query,
  mode,
  isSearching,
  recentHistory,
  onQueryChange,
  onModeChange,
  onSubmitSearch,
  onClearSearch,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setDropdownOpen(true);
      } else if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        setDropdownOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDropdownOpen(false);
    onSubmitSearch();
  };

  return (
    <div ref={containerRef} className="relative">
      <form
        onSubmit={handleFormSubmit}
        role="search"
        aria-label="Search files and folders"
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs"
      >
        <div className="flex items-center flex-1 gap-2.5 px-2">
          <Search
            className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onFocus={() => setDropdownOpen(true)}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={
              mode === 'semantic'
                ? 'Describe what you need, e.g. "My students exams paper pdfs or the folder"'
                : 'Search by filename, tag, extension, or folder...'
            }
            aria-label="Search query input"
            className="w-full py-1.5 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                onClearSearch();
                inputRef.current?.focus();
              }}
              aria-label="Clear search query"
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden md:inline-block font-mono text-[11px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 shrink-0">
            Ctrl+K
          </kbd>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="Search mode"
            className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800"
          >
            <button
              type="button"
              onClick={() => onModeChange('semantic')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                mode === 'semantic'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Semantic AI
            </button>
            <button
              type="button"
              onClick={() => onModeChange('keyword')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                mode === 'keyword'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Keyword & Tags
            </button>
          </div>

          <button
            type="submit"
            disabled={isSearching}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {isSearching ? 'Searching...' : 'Find Files'}
          </button>
        </div>
      </form>

      {dropdownOpen && (
        <div className="absolute left-0 right-0 mt-2 z-30 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg p-3 space-y-3">
          {recentHistory.length > 0 && (
            <div>
              <div className="px-2 pb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                Recent Searches
              </div>
              <div className="space-y-0.5">
                {recentHistory.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onQueryChange(item.query);
                      onModeChange(item.mode);
                      onSubmitSearch(item.query, item.mode);
                    }}
                    className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{item.query}</span>
                    </span>
                    <span className="font-mono tabular-nums text-xs text-slate-400 dark:text-slate-500 shrink-0">
                      {item.mode} · {item.matchedFileCount} files
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="px-2 pb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              Try Natural-Language Semantic Queries
            </div>
            <div className="space-y-0.5">
              {EXAMPLE_SEMANTIC_QUERIES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    onQueryChange(example);
                    onModeChange('semantic');
                    onSubmitSearch(example, 'semantic');
                  }}
                  className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="truncate">“{example}”</span>
                  <span className="text-xs text-blue-600 dark:text-blue-400 shrink-0">
                    Run query
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
