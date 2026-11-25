import React, { useState } from 'react';
import {
  Check,
  Database,
  Download,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Unlock,
  WifiOff,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { SyncQueueItem, WorkspaceSettings } from '../types/files';
import { formatRelativeAge } from '../utils/formatters';

interface SecuritySyncViewProps {
  settings: WorkspaceSettings;
  keyFingerprint: string;
  vectorCount: number;
  isVaultLocked: boolean;
  isOnline: boolean;
  syncQueue: SyncQueueItem[];
  isSyncing: boolean;
  onUpdateSettings: (patch: Partial<WorkspaceSettings>) => void;
  onSetPassphrase: (passphrase: string) => Promise<void>;
  onUnlockVault: (passphrase: string) => Promise<boolean>;
  onLockVault: () => void;
  onSyncNow: () => void;
  onRebuildVectors: () => void;
}

export const SecuritySyncView: React.FC<SecuritySyncViewProps> = ({
  settings,
  keyFingerprint,
  vectorCount,
  isVaultLocked,
  isOnline,
  syncQueue,
  isSyncing,
  onUpdateSettings,
  onSetPassphrase,
  onUnlockVault,
  onLockVault,
  onSyncNow,
  onRebuildVectors,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [passphraseInput, setPassphraseInput] = useState('');
  const [unlockInput, setUnlockInput] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [copiedCli, setCopiedCli] = useState(false);

  const cliSnippet = `pip install -r python_organizer/requirements.txt
python -m python_organizer.cli organize ~/Desktop
python -m python_organizer.cli search "my student exam papers"`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
          Privacy, Local Encryption & Offline Sync
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Sensitive files are encrypted on-device with AES-256-GCM. Vector indexing and offline changes sync automatically when online.
        </p>
      </div>

      {/* Encryption & Privacy Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                  On-Device AES-256-GCM Vault
                </h3>
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  Key Fingerprint: {keyFingerprint}
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-semibold ${
                isVaultLocked
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {isVaultLocked ? 'Locked' : 'Unlocked'}
            </span>
          </div>

          {/* Strict Local-Only Mode */}
          <div className="flex items-start justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Strict Local-Only Processing
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Blocks all external AI analysis and semantic API calls. Uses only the local vector engine and on-device classifier.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.strictLocalOnly}
              onClick={() => onUpdateSettings({ strictLocalOnly: !settings.strictLocalOnly })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                settings.strictLocalOnly ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                  settings.strictLocalOnly ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Passphrase Vault Lock */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            {isVaultLocked ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const ok = await onUnlockVault(unlockInput);
                  if (ok) {
                    setUnlockInput('');
                    setAuthMessage('Vault unlocked.');
                  } else {
                    setAuthMessage('Incorrect passphrase.');
                  }
                }}
                className="space-y-2"
              >
                <label
                  htmlFor="unlock-passphrase"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Enter Master Passphrase to Decrypt File Previews
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="unlock-passphrase"
                    type="password"
                    value={unlockInput}
                    onChange={(e) => setUnlockInput(e.target.value)}
                    placeholder="Passphrase..."
                    className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    Unlock
                  </button>
                </div>
              </form>
            ) : settings.hasPassphraseLock ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" />
                  Master passphrase lock enabled
                </span>
                <button
                  type="button"
                  onClick={onLockVault}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Lock Vault Now
                </button>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (passphraseInput.trim().length < 4) {
                    setAuthMessage('Passphrase must be at least 4 characters.');
                    return;
                  }
                  await onSetPassphrase(passphraseInput.trim());
                  setPassphraseInput('');
                  setAuthMessage('Master passphrase enabled and vault locked.');
                }}
                className="space-y-2"
              >
                <label
                  htmlFor="set-passphrase"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Protect Decrypted Previews with a Master Passphrase
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="set-passphrase"
                    type="password"
                    value={passphraseInput}
                    onChange={(e) => setPassphraseInput(e.target.value)}
                    placeholder="Set vault passphrase..."
                    className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Enable Lock
                  </button>
                </div>
              </form>
            )}
            {authMessage && (
              <p className="text-xs text-blue-600 dark:text-blue-400">{authMessage}</p>
            )}
          </div>
        </section>

        {/* Offline Support & Sync Queue */}
        <section className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Offline Support & Sync Queue
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isOnline
                  ? 'Connected — queued cloud operations sync automatically.'
                  : 'Offline — changes remain encrypted locally until reconnected.'}
              </p>
            </div>
            {isInstallable && !isInstalled && (
              <button
                type="button"
                onClick={install}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                Install App
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Simulate Offline Mode
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Test local semantic search and queuing cloud archives without connectivity.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.simulateOffline}
              onClick={() => onUpdateSettings({ simulateOffline: !settings.simulateOffline })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                settings.simulateOffline ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                  settings.simulateOffline ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Pending Sync Operations ({syncQueue.length})
              </span>
              {syncQueue.length > 0 && isOnline && (
                <button
                  type="button"
                  onClick={onSyncNow}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </button>
              )}
            </div>

            {syncQueue.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                All local changes and cloud archives are synced.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                {syncQueue.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {item.action.toUpperCase()}: {item.fileName}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">
                        Queued {formatRelativeAge(item.createdAt)}
                      </p>
                    </div>
                    <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1 shrink-0">
                      <WifiOff className="h-3 w-3" />
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Local Vector Database & Python ChromaDB Companion */}
      <section className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Database className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Local Vector Index & Python ChromaDB Companion
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                In-browser IndexedDB Vector Store (<span className="font-mono tabular-nums">{vectorCount}</span> indexed embeddings) + local Python ChromaDB CLI in <span className="font-mono">/python_organizer</span>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRebuildVectors}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Rebuild Vector Index
          </button>
        </div>

        <div className="rounded-lg bg-slate-950 text-slate-100 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-mono">
              <Terminal className="h-3.5 w-3.5" />
              python_organizer (ChromaDB + all-MiniLM-L6-v2)
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(cliSnippet);
                setCopiedCli(true);
                setTimeout(() => setCopiedCli(false), 1800);
              }}
              className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white"
            >
              {copiedCli ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : null}
              {copiedCli ? 'Copied' : 'Copy commands'}
            </button>
          </div>
          <pre className="font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed">
            {cliSnippet}
          </pre>
        </div>
      </section>
    </div>
  );
};
