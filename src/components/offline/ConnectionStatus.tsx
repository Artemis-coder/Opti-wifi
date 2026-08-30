'use client';

import React from 'react';
import { WifiOff, Wifi, RefreshCw, AlertTriangle } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { processOfflineQueue } from '@/lib/offline/sync';
import { getQueueLength } from '@/lib/offline/queue';
import { toast } from 'sonner';

export function ConnectionStatus() {
  const { status, isOnline, isOffline, isUnstable, isChecking, setPendingActions } = useOnlineStatus();
  const [syncing, setSyncing] = React.useState(false);
  const [pendingCount, setPendingCount] = React.useState(getQueueLength());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setPendingCount(getQueueLength());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (isOnline && pendingCount > 0) {
      handleSync();
    }
  }, [isOnline]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await processOfflineQueue();
      const remaining = getQueueLength();
      setPendingCount(remaining);
      setPendingActions(remaining);
    } finally {
      setSyncing(false);
    }
  };

  if (isChecking) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (isOffline) {
    return (
      <div className="fixed top-4 right-4 z-50" title="Mode Hors Ligne">
        <WifiOff className="w-6 h-6 text-red-600" />
      </div>
    );
  }

  if (isUnstable) {
    return (
      <div className="fixed top-4 right-4 z-50" title="Connexion instable">
        <AlertTriangle className="w-6 h-6 text-amber-600" />
      </div>
    );
  }

  if (isOnline && pendingCount > 0) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center justify-center w-10 h-10 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/50 text-white rounded-full shadow-lg transition-colors"
          title={`${pendingCount} action(s) en attente`}
        >
          <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50" title="En ligne">
      <Wifi className="w-6 h-6 text-emerald-600" />
    </div>
  );
}