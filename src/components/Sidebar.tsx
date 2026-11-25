import React from 'react';
import {
  Archive,
  Clock,
  Folder,
  FolderKanban,
  Home,
  Lock,
  Moon,
  RefreshCw,
  Shield,
  Sun,
  WifiOff,
} from 'lucide-react';
import { ActiveNavView, FolderNode, VaultFile } from '../types/files';

interface SidebarProps {
  activeView: ActiveNavView;
  onSelectView: (view: ActiveNavView) => void;
  folders: FolderNode[];
  files: VaultFile[];
  selectedFolderFilter: string | null;
  onSelectFolder: (folderName: string | null) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  isOnline: boolean;
  strictLocalOnly: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  onSyncNow: () => void;
  isLocked: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  folders,
  files,
  selectedFolderFilter,
  onSelectFolder,
  theme,
  onToggleTheme,
  isOnline,
  strictLocalOnly,
  pendingSyncCount,
  isSyncing,
  onSyncNow,
  isLocked,
  mobileOpen,
  onCloseMobile,
}) => {
  const navItems: Array<{ id: ActiveNavView; label: string; icon: React.ReactNode; count?: number }> = [
    {
      id: 'quick-access',
      label: 'Quick Access',
      icon: <Home className="h-4 w-4 shrink-0" />,
    },
    {
      id: 'explorer',
      label: 'Desktop & Folders',
      icon: <FolderKanban className="h-4 w-4 shrink-0" />,
      count: files.filter((f) => f.status !== 'archived').length,
    },
    {
      id: 'search-history',
      label: 'Search History',
      icon: <Clock className="h-4 w-4 shrink-0" />,
    },
    {
      id: 'cloud-archive',
      label: 'Cloud Archive',
      icon: <Archive className="h-4 w-4 shrink-0" />,
      count: files.filter((f) => f.status === 'archived').length,
    },
    {
      id: 'security-sync',
      label: 'Security & Sync',
      icon: <Shield className="h-4 w-4 shrink-0" />,
    },
  ];

  const desktopCount = files.filter((f) => f.status === 'desktop').length;

  const content = (
    <div className="flex h-full flex-col justify-between bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="flex items-center justify-between px-2 mb-6">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              onSelectFolder(null);
              onSelectView('quick-access');
              onCloseMobile();
            }}
            className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            DeskSort
          </a>
          {isLocked && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Locked
            </span>
          )}
        </div>

        <nav aria-label="Primary navigation" className="space-y-1">
          {navItems.map((item) => {
            const isActive = activeView === item.id && !selectedFolderFilter;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectFolder(null);
                  onSelectView(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.count === 'number' && (
                  <span className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-7 pt-5 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between px-2 mb-2">
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Designated Folders
            </h2>
            <span className="font-mono tabular-nums text-xs text-slate-400 dark:text-slate-500">
              {folders.length}
            </span>
          </div>

          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => {
                onSelectFolder('Desktop');
                onSelectView('explorer');
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                selectedFolderFilter === 'Desktop'
                  ? 'bg-slate-100 font-semibold text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Folder className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="truncate">Desktop (Unsorted)</span>
              </span>
              <span className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                {desktopCount}
              </span>
            </button>

            {folders.map((folder) => {
              const count = files.filter(
                (f) => f.folderName === folder.name && f.status === 'organized'
              ).length;
              const active = selectedFolderFilter === folder.name;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => {
                    onSelectFolder(folder.name);
                    onSelectView('explorer');
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    active
                      ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Folder className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    <span className="truncate">{folder.name}</span>
                  </span>
                  <span className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1.5 truncate">
            {!isOnline ? (
              <>
                <WifiOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Offline · Queued ({pendingSyncCount})</span>
              </>
            ) : pendingSyncCount > 0 ? (
              <>
                <RefreshCw className={`h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{pendingSyncCount} pending sync</span>
              </>
            ) : strictLocalOnly ? (
              <>
                <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Local-only encryption</span>
              </>
            ) : (
              <>
                <Shield className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>AES-256 Vault Active</span>
              </>
            )}
          </span>
          {pendingSyncCount > 0 && isOnline && (
            <button
              type="button"
              onClick={onSyncNow}
              disabled={isSyncing}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1"
            >
              {isSyncing ? 'Syncing' : 'Sync'}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <span className="flex items-center gap-2">
            {theme === 'dark' ? (
              <Sun className="h-3.5 w-3.5 text-amber-400" />
            ) : (
              <Moon className="h-3.5 w-3.5 text-slate-600" />
            )}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </span>
          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
            {theme === 'dark' ? 'DARK' : 'LIGHT'}
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-[260px] shrink-0 h-screen sticky top-0">
        {content}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[260px] max-w-[85vw] h-full">
            {content}
          </aside>
        </div>
      )}
    </>
  );
};
