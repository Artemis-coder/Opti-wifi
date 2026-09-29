'use client';

import React from 'react';
import { WifiOff, Wifi, RefreshCw, AlertTriangle, CloudUpload } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { processOfflineQueue } from '@/lib/offline/sync';
import { getQueueLength } from '@/lib/offline/queue';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';

/** Material 3 status chip surface. */
const CHIP = cn(
  'md-ripple inline-flex items-center gap-2 min-h-11 pl-3.5 pr-4 rounded-full',
  'md-elevation-2 text-[13px] font-semibold leading-none whitespace-nowrap'
);

export function ConnectionStatus() {
  const { isOnline, isOffline, isUnstable, isChecking, setPendingActions } = useOnlineStatus();
  const [syncing, setSyncing] = React.useState(false);
  const [pendingCount, setPendingCount] = React.useState(getQueueLength);

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

  // Poll the queue: mutations can be enqueued by any screen, not just this one.
  React.useEffect(() => {
    const interval = setInterval(() => {
      setPendingCount(getQueueLength());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Coming back online flushes whatever was queued while offline. Guarded by a
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

  // Anchored below the app bar so it never sits under the header controls.
  const anchor = 'app-status-anchor fixed right-3 z-50';

  if (isChecking) {
    return (
      <div className={anchor} role="status" aria-live="polite">
        <span className={cn(CHIP, 'bg-slate-100 text-slate-600 border border-slate-200')}>
          <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
          Vérification…
        </span>
      </div>
    );
  }

  if (isOffline) {
    return (
      <div className={anchor} role="status" aria-live="polite">
        <span className={cn(CHIP, 'bg-red-50 text-red-700 border border-red-200')}>
          <WifiOff className="w-4 h-4 shrink-0" />
          Hors ligne
        </span>
      </div>
    );
  }

  if (isUnstable) {
    return (
      <div className={anchor} role="status" aria-live="polite">
        <span className={cn(CHIP, 'bg-amber-50 text-amber-800 border border-amber-200')}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Connexion instable
        </span>
      </div>
    );
  }

  if (isOnline && pendingCount > 0) {
    return (
      <div className={anchor}>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          aria-label={`${pendingCount} action(s) en attente, synchroniser maintenant`}
          className={cn(
            CHIP,
            'bg-amber-500 text-slate-950 border border-amber-600 disabled:opacity-70'
          )}
        >
          <CloudUpload className={cn('w-4 h-4 shrink-0', syncing && 'animate-bounce')} />
          {pendingCount} en attente
        </button>
      </div>
    );
  }

  return (
    <div className={anchor} role="status" aria-live="polite" title="En ligne">
      <span
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-full',
          'bg-emerald-50 text-emerald-600 border border-emerald-200 md-elevation-1'
        )}
      >
        <Wifi className="w-4 h-4" />
      </span>
    </div>
  );
}
