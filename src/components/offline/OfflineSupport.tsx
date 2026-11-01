'use client';

import { useEffect } from 'react';
import { cachedSessionUser } from '@/lib/offline/store';

const WARMUP_KEY = 'optispace:offline-warmup';
// Écrans gardés sur l'appareil pour être consultables hors ligne
const WARMUP_PAGES = ['/dashboard', '/pos', '/collections', '/collections/new', '/allocations', '/tickets'];

const PAGES_CACHE = 'optispace-pages-v1'; // même nom que dans public/sw.js

/**
 * Garde une page (HTML) et les fichiers qu'elle charge : elle s'ouvre ensuite sans réseau.
 * Ses données sont gardées à la première visite en ligne.
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
 * Mode hors ligne : active le service worker pour tous, puis, une fois par session et en
 * ligne, garde en arrière-plan les écrans principaux pour qu'ils s'ouvrent sans réseau.
 */
export function OfflineSupport() {
  useEffect(() => {
    if (window.self !== window.top || !('serviceWorker' in navigator)) return;
    let cancelled = false;

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
    };
  }, []);

  return null;
}
