'use client';

import React from 'react';
import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { processOfflineQueue } from '@/lib/offline/sync';
import { getQueueLength } from '@/lib/offline/queue';

export function ConnectionStatus() {
  const { isOnline, isOffline, isUnstable, isChecking, setPendingActions } = useOnlineStatus();
  const [syncing, setSyncing] = React.useState(false);
  const [pendingCount, setPendingCount] = React.useState(getQueueLength());
  const syncingRef = React.useRef(false);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setPendingCount(getQueueLength());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleSync = React.useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      await processOfflineQueue();
      const remaining = getQueueLength();
      setPendingCount(remaining);
      setPendingActions(remaining);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [setPendingActions]);

  // Retour en ligne avec des actions en attente : synchronisation automatique
  React.useEffect(() => {
    if (isOnline && pendingCount > 0) void handleSync();
  }, [isOnline, pendingCount, handleSync]);

  // Connexion normale : rien à afficher (l'en-tête indique déjà « En ligne »). Avant, une icône
  // fixe en haut à droite se superposait aux boutons de l'en-tête sur toutes les pages.
  if (isChecking || (isOnline && pendingCount === 0)) return null;

  // Problème de connexion : pastille avec texte, centrée sous la barre d'en-tête
  const chip =
    'fixed app-status-anchor left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3.5 py-2 rounded-full shadow-lg text-xs font-semibold whitespace-nowrap';

  if (isOffline) {
    return (
      <div role="status" className={`${chip} bg-red-600 text-white`}>
        <WifiOff className="w-4 h-4" /> Hors ligne
        {pendingCount > 0 && <span className="font-normal opacity-90">· {pendingCount} action(s) en attente</span>}
      </div>
    );
  }

  if (isUnstable) {
    return (
      <div role="status" className={`${chip} bg-amber-500 text-slate-950`}>
        <AlertTriangle className="w-4 h-4" /> Connexion instable
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={syncing}
      className={`${chip} bg-amber-600 hover:bg-amber-700 disabled:opacity-70 text-white transition-colors`}
    >
      <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
      {syncing ? 'Synchronisation…' : `Synchroniser ${pendingCount} action(s)`}
    </button>
  );
}