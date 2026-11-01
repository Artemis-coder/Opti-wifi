'use client';

import { useEffect } from 'react';
import { cachedSessionUser } from '@/lib/offline/store';
import { startOfflineSession } from '@/lib/offline/replica';

const REPLICA_EVERY = 5 * 60 * 1000;
const WARMUP_KEY = 'optispace:offline-warmup';
// Écrans gardés sur l'appareil pour être consultables hors ligne
const WARMUP_PAGES = ['/dashboard', '/pos', '/spaces', '/collections', '/collections/new', '/allocations', '/allocations/new', '/tickets', '/reports', '/users'];
const PAGES_CACHE = 'optispace-pages-v1'; // même nom que dans public/sw.js

/**
 * Garde une page (HTML) et les fichiers qu'elle charge : elle s'ouvre ensuite sans réseau.
 * Ses données viennent de la copie locale de l'espace.
 */
async function precache(path: string): Promise<void> {
  const res = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
  if (!res.ok || res.redirected) return;
  const html = await res.clone().text();
  await (await caches.open(PAGES_CACHE)).put(new URL(path, window.location.origin).href, res);
  // Les fichiers passent par le service worker, qui les garde
  const assets = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || []);
  await Promise.all([...assets].map((a) => fetch(a).catch(() => undefined)));
}

/**
 * Mode hors ligne : active le service worker pour tous, garde une copie locale des données
 * de l'espace (rafraîchie régulièrement) et, une fois par session, les écrans principaux pour
 * qu'ils s'ouvrent sans réseau.
 */
export function OfflineSupport() {
  useEffect(() => {
    if (window.self !== window.top || !('serviceWorker' in navigator)) return;
    let cancelled = false;

    // Copie locale des données de l'espace : au chargement si elle date, puis régulièrement
    const syncReplica = () => {
      if (!navigator.onLine) return;
      void fetch('/api/auth/session', { cache: 'no-store', credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json) return startOfflineSession(json.user ?? null, { maxAge: REPLICA_EVERY - 5000 });
        })
        .catch(() => {});
    };
    const replicaTimer = setInterval(syncReplica, REPLICA_EVERY);
    const firstReplica = setTimeout(syncReplica, 1500);
    window.addEventListener('online', syncReplica);

    const warmup = async () => {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      if (!navigator.onLine || !cachedSessionUser() || sessionStorage.getItem(WARMUP_KEY)) return;
      sessionStorage.setItem(WARMUP_KEY, String(Date.now()));
      for (const path of WARMUP_PAGES) {
        if (cancelled || !navigator.onLine) return;
        if (path === window.location.pathname) continue;
        await precache(path).catch(() => {});
      }
    };

    // Après l'affichage de la page, pour ne pas la ralentir
    const timer = setTimeout(() => void warmup().catch(() => {}), 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(firstReplica);
      clearInterval(replicaTimer);
      window.removeEventListener('online', syncReplica);
    };
  }, []);

  return null;
}
