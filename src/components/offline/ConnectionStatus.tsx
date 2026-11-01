'use client';

import React from 'react';
import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { processOfflineQueue } from '@/lib/offline/sync';
import { lastSyncAt, OFFLINE_EVENTS, queueCount } from '@/lib/offline/store';

const time = (ms: number) =>
  new Date(ms).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Pastille d'état de connexion : hors ligne (avec la date des données affichées et les
 * collectes en attente), connexion instable, ou synchronisation des actions hors ligne.
 * Au retour du réseau, les actions en attente sont envoyées automatiquement.
 */
export function ConnectionStatus() {
  const { isOnline, isOffline, isUnstable, isChecking, setPendingActions } = useOnlineStatus();
  const [syncing, setSyncing] = React.useState(false);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [dataAt, setDataAt] = React.useState<number | null>(null);
  const syncingRef = React.useRef(false);

  // Nombre d'actions en attente (mis à jour à chaque ajout / envoi)
  React.useEffect(() => {
    const refresh = () => {
      void queueCount().then((n) => {
        setPendingCount(n);
        setPendingActions(n);
      });
    };
    const onCache = (e: Event) => setDataAt((e as CustomEvent<number>).detail ?? lastSyncAt());
    refresh();
    window.addEventListener(OFFLINE_EVENTS.queueChanged, refresh);
    window.addEventListener(OFFLINE_EVENTS.servedFromCache, onCache);
    return () => {
      window.removeEventListener(OFFLINE_EVENTS.queueChanged, refresh);
      window.removeEventListener(OFFLINE_EVENTS.servedFromCache, onCache);
    };
  }, [setPendingActions]);

  const handleSync = React.useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      await processOfflineQueue();
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []);

  // Retour en ligne avec des actions en attente : synchronisation automatique
  React.useEffect(() => {
    if (isOnline && pendingCount > 0) void handleSync();
  }, [isOnline, pendingCount, handleSync]);

  // Connexion normale : rien à afficher (l'en-tête indique déjà « En ligne »).
  if (isChecking || (isOnline && pendingCount === 0)) return null;

  // Problème de connexion : pastille avec texte, centrée sous la barre d'en-tête
  const chip =
    'fixed app-status-anchor left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3.5 py-2 rounded-full shadow-lg text-xs font-semibold max-w-[calc(100vw-1.5rem)]';

  if (isOffline) {
    const at = dataAt ?? lastSyncAt();
    return (
      <div role="status" className={`${chip} bg-red-600 text-white`}>
        <WifiOff className="w-4 h-4 shrink-0" />
        <span className="truncate">
          Hors ligne{at ? ` · données du ${time(at)}` : ''}
          {pendingCount > 0 && ` · ${pendingCount} à synchroniser`}
        </span>
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
