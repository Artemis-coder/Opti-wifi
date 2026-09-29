'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { WifiOff, Wifi, RefreshCw, AlertTriangle, CloudUpload, Activity } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useNetworkMetrics, formatBytes } from '@/hooks/useNetworkMetrics';
import { processOfflineQueue } from '@/lib/offline/sync';
import { getQueueLength } from '@/lib/offline/queue';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';

type Tone = 'ok' | 'warn' | 'bad' | 'busy';

const TONE: Record<Tone, string> = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-800 border-amber-200',
  bad: 'bg-red-50 text-red-700 border-red-200',
  busy: 'bg-slate-100 text-slate-600 border-slate-200',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-[13px] text-slate-500">{label}</span>
      <span className="text-[13px] font-semibold text-slate-900 dark:text-white text-right">
        {value}
      </span>
    </div>
  );
}

export function ConnectionStatus() {
  const pathname = usePathname();
  const { isOnline, isOffline, isUnstable, isChecking, setPendingActions } = useOnlineStatus();
  const { connection, traffic } = useNetworkMetrics();

  const [syncing, setSyncing] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [pendingCount, setPendingCount] = React.useState(0);

  React.useEffect(() => {
    // Deferred so the first read does not land in the same render as the mount
    // (server and client would disagree on the pending count).
    const tick = () => setPendingCount(getQueueLength());
    const initial = setTimeout(tick, 0);
    const interval = setInterval(tick, 2000);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  const handleSync = React.useCallback(async () => {
    setSyncing(true);
    try {
      await processOfflineQueue();
      const remaining = getQueueLength();
      setPendingCount(remaining);
      setPendingActions(remaining);
      toast.success(
        remaining === 0
          ? 'Toutes les actions hors ligne ont été synchronisées'
          : `${remaining} action(s) restent en attente`
      );
    } catch {
      toast.error('Synchronisation impossible pour le moment');
    } finally {
      setSyncing(false);
    }
  }, [setPendingActions]);

  // Flush the queue once per session when connectivity comes back. Guarded by a
  // ref so a queue that cannot drain does not spin a sync loop.
  const autoSyncedRef = React.useRef(false);
  React.useEffect(() => {
    if (!isOnline) {
      autoSyncedRef.current = false;
      return;
    }
    if (autoSyncedRef.current || pendingCount === 0) return;

    autoSyncedRef.current = true;
    handleSync();
  }, [isOnline, pendingCount, handleSync]);

  const { tone, label, icon: Icon, showLabel } = ((): {
    tone: Tone;
    label: string;
    icon: typeof Wifi;
    showLabel: boolean;
  } => {
    if (isChecking) {
      return { tone: 'busy', label: 'Vérification…', icon: RefreshCw, showLabel: true };
    }
    if (isOffline) {
      return { tone: 'bad', label: 'Hors ligne', icon: WifiOff, showLabel: true };
    }
    if (isUnstable) {
      return { tone: 'warn', label: 'Instable', icon: AlertTriangle, showLabel: true };
    }
    if (pendingCount > 0) {
      return {
        tone: 'warn',
        label: `${pendingCount} en attente`,
        icon: CloudUpload,
        showLabel: true,
      };
    }
    return { tone: 'ok', label: 'En ligne', icon: Wifi, showLabel: false };
  })();

  // Screens without the bottom navigation (login) keep the pill near the edge.
  const isStandalone =
    pathname === '/login' || pathname === '/platform/login' || pathname === '/';

  return (
    <>
      <div
        className={cn(
          'fixed right-3 z-50',
          isStandalone ? 'app-net-anchor-standalone' : 'app-net-anchor'
        )}
      >
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          aria-label={`Connexion ${label}. Voir les détails réseau`}
          className={cn(
            'md-ripple inline-flex h-10 items-center gap-2 rounded-full border md-elevation-2',
            showLabel ? 'pl-3 pr-4' : 'w-10 justify-center',
            TONE[tone]
          )}
        >
          <Icon className={cn('w-4 h-4 shrink-0', isChecking && 'animate-spin')} />
          {showLabel && <span className="text-[12px] font-semibold leading-none">{label}</span>}
        </button>
      </div>

      <Modal
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title="État de la connexion"
      >
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-3">
          <span className={cn('flex h-10 w-10 items-center justify-center rounded-full', TONE[tone])}>
            <Icon className={cn('w-5 h-5', isChecking && 'animate-spin')} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
            <p className="text-[11px] text-slate-500">
              {connection.type
                ? `Type : ${connection.type}${connection.effectiveType ? ` · ${connection.effectiveType.toUpperCase()}` : ''}`
                : 'Type de connexion non exposé'}
            </p>
          </div>
        </div>

        <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 px-4">
          <Row
            label="Débit descendant estimé"
            value={
              connection.downlink != null
                ? `${connection.downlink.toFixed(1)} Mbit/s`
                : 'Non disponible'
            }
          />
          <Row
            label="Latence"
            value={connection.rtt != null ? `${Math.round(connection.rtt)} ms` : 'Non disponible'}
          />
          <Row label="Données reçues" value={formatBytes(traffic.received)} />
          <Row label="Données envoyées" value={formatBytes(traffic.sent)} />
          <Row label="Actions hors ligne" value={String(pendingCount)} />
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          Le débit et la latence sont des estimations fournies par le téléphone
          (Network Information API). Les volumes de données sont mesurés sur les
          requêtes et réponses échangées par l&apos;application depuis son
          ouverture.
        </p>

        {pendingCount > 0 && (
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="md-ripple mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 text-sm font-semibold text-slate-950 disabled:opacity-60"
          >
            <CloudUpload className={cn('w-4 h-4', syncing && 'animate-bounce')} />
            {syncing ? 'Synchronisation…' : `Synchroniser ${pendingCount} action(s)`}
          </button>
        )}

        <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
          <Activity className="mt-0.5 w-4 h-4 shrink-0 text-slate-400" />
          <p className="text-[11px] leading-relaxed text-slate-500">
            Android n&apos;expose pas de compteur d&apos;octets temps réel à une
            application WebView : ces volumes couvrent uniquement le trafic de
            l&apos;application, pas l&apos;usage du téléphone dans son ensemble.
          </p>
        </div>
      </Modal>
    </>
  );
}
