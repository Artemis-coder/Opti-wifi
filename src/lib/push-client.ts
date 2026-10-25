// ============================================================
// OPTIWIFI - Notifications push côté navigateur (service worker + abonnement).
// ============================================================

export type PushState = 'unsupported' | 'ios-needs-install' | 'denied' | 'default' | 'subscribed';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration('/')) || navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function getPushState(): Promise<PushState> {
  if (typeof window === 'undefined') return 'unsupported';
  if (!isPushSupported()) return isIos() && !isStandalone() ? 'ios-needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'subscribed' : 'default';
}

/** Demande l'autorisation, abonne ce navigateur et l'enregistre côté serveur. */
export async function subscribeToPush(): Promise<PushState> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!isPushSupported() || !publicKey) return 'unsupported';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'default';

  const reg = await getRegistration();
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));

  const res = await fetch('/api/notifications/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  });
  return res.ok ? 'subscribed' : 'default';
}

/** Désabonne ce navigateur (ex. à la déconnexion d'un appareil partagé). */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch('/api/notifications/push', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}
