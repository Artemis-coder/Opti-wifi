'use client';

import React from 'react';
import { WifiOff, Wifi, RefreshCw, AlertTriangle, CloudUpload } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useNetworkMetrics } from '@/hooks/useNetworkMetrics';
import { processOfflineQueue } from '@/lib/offline/sync';
import { getQueueLength } from '@/lib/offline/queue';
import { toast } from 'sonner';

export type Tone = 'ok' | 'warn' | 'bad' | 'busy';

export const TONE_SURFACE: Record<Tone, string> = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-800 border-amber-200',
  bad: 'bg-red-50 text-red-700 border-red-200',
  busy: 'bg-slate-100 text-slate-600 border-slate-200',
};

export type StatusIcon = typeof Wifi;

/**
 * Single source of truth for the network status: connection state, measured
 * traffic, offline queue and the detail sheet. Shared by the navigation bar
 * slot and by the floating variant used on screens without a bottom bar.
 */
export function useNetworkPanel() {
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

  const status = ((): {
    tone: Tone;
    label: string;
    icon: StatusIcon;
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

  return {
    ...status,
    isSyncing: syncing,
    pendingCount,
    connection,
    traffic,
    detailsOpen,
    setDetailsOpen,
    handleSync,
  };
}
