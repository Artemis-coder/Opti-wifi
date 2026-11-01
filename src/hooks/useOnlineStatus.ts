'use client';

import { useState, useEffect, useCallback } from 'react';

export type ConnectionStatus = 'online' | 'offline' | 'checking' | 'unstable';

export function useOnlineStatus() {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [pendingActions, setPendingActions] = useState(0);

  const checkConnection = useCallback(async () => {
    try {
      const start = Date.now();

      // Vrai test réseau : /api/ping n'est jamais servi depuis un cache (contrairement aux
      // lectures de données, qui ont une copie locale pour le mode hors ligne)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch('/api/ping', { cache: 'no-store', signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error('ping');

      const latency = Date.now() - start;

      if (latency > 3000) {
        setStatus('unstable');
      } else {
        setStatus('online');
      }

      setLastChecked(new Date());
      return true;
    } catch {
      setStatus('offline');
      setLastChecked(new Date());
      return false;
    }
  }, []);

  useEffect(() => {
    const updateOnlineStatus = () => {
      if (navigator.onLine) {
        checkConnection();
      } else {
        setStatus('offline');
        setLastChecked(new Date());
      }
    };

    updateOnlineStatus();

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    const interval = setInterval(checkConnection, 15000);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      clearInterval(interval);
    };
  }, [checkConnection]);

  const refresh = useCallback(async () => {
    setStatus('checking');
    await checkConnection();
  }, [checkConnection]);

  return {
    status,
    isOnline: status === 'online',
    isOffline: status === 'offline',
    isUnstable: status === 'unstable',
    isChecking: status === 'checking',
    lastChecked,
    pendingActions,
    setPendingActions,
    refresh,
  };
}