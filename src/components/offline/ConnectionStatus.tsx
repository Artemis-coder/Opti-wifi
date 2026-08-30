'use client';

import React from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { processOfflineQueue } from '@/lib/offline/sync';
import { getQueueLength } from '@/lib/offline/queue';
import { toast } from 'sonner';

export function ConnectionStatus() {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [syncing, setSyncing] = React.useState(false);
  const [pendingCount, setPendingCount] = React.useState(getQueueLength());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setPendingCount(getQueueLength());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (isOnline && wasOffline && pendingCount > 0) {
      handleSync();
    }
  }, [isOnline, wasOffline]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await processOfflineQueue();
      setPendingCount(getQueueLength());
    } finally {
      setSyncing(false);
    }
  };

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      {!isOnline && (
        <div className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">Mode Hors Ligne</span>
        </div>
      )}
      {isOnline && pendingCount > 0 && (
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/50 text-white px-4 py-2 rounded-lg shadow-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          <span className="text-sm font-medium">
            {syncing ? 'Synchronisation...' : `${pendingCount} en attente`}
          </span>
        </button>
      )}
    </div>
  );
}