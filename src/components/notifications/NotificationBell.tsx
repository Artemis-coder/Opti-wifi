'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Bell, BellRing, CheckCheck, Smartphone, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import { getPushState, subscribeToPush, type PushState } from '@/lib/push-client';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

// Rafraîchissement de secours quand le push n'est pas activé (l'onglet doit être visible).
// Avec le push activé, le service worker prévient l'onglet instantanément.
const POLL_MS = 10_000;

function timeAgo(date: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  if (s < 60) return "à l'instant";
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'hier' : `il y a ${d} j`;
}

// Téléphone (< 640 px) : panneau du bas, comme les filtres (CustomSelect) ; au-delà : menu déroulant.
const mobileQuery = '(max-width: 639px)';
function subscribeMobile(cb: () => void) {
  const mq = window.matchMedia(mobileQuery);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
function useIsMobile() {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(mobileQuery).matches,
    () => false,
  );
}

export function NotificationBell({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [pushState, setPushState] = useState<PushState>('unsupported');
  const [enabling, setEnabling] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const seenIds = useRef<Set<string> | null>(null);
  const isMobile = useIsMobile();

  // Chargement + rafraîchissement : instantané via le service worker (push),
  // au retour sur l'onglet, et périodique en secours.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (document.visibilityState === 'hidden') return;
      fetch('/api/notifications?limit=20', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((res) => {
          if (cancelled || !res) return;
          const list: NotificationItem[] = res.data || [];
          // Nouvelles notifications depuis le dernier chargement : on les affiche en toast
          if (seenIds.current) {
            const fresh = list.filter((n) => !n.read_at && !seenIds.current!.has(n.id));
            if (fresh.length > 2) {
              toast(`${fresh.length} nouvelles notifications`, {
                action: { label: 'Voir', onClick: () => setOpen(true) },
              });
            } else {
              fresh.forEach((n) =>
                toast(n.title, {
                  description: n.body || undefined,
                  action: { label: 'Voir', onClick: () => setOpen(true) },
                }),
              );
            }
          }
          seenIds.current = new Set(list.map((n) => n.id));
          setItems(list);
          setUnread(res.unread || 0);
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, POLL_MS);
    const onSwMessage = (e: MessageEvent) => {
      if (e.data?.type === 'optispace:notification') load();
    };
    document.addEventListener('visibilitychange', load);
    window.addEventListener('focus', load);
    navigator.serviceWorker?.addEventListener('message', onSwMessage);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
      window.removeEventListener('focus', load);
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
    };
  }, [reloadKey]);

  // Nombre de non-lues dans le titre de l'onglet
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\) /, '');
    document.title = unread > 0 ? `(${unread > 99 ? '99+' : unread}) ${base}` : base;
  }, [unread]);

  useEffect(() => {
    getPushState()
      .then(setPushState)
      .catch(() => setPushState('unsupported'));
  }, []);

  // Menu déroulant : fermer en cliquant à l'extérieur (le panneau mobile a son propre fond cliquable)
  useEffect(() => {
    if (!open || isMobile) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open, isMobile]);

  // Échap ferme ; panneau mobile : la page derrière ne défile plus
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    if (isMobile) document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      if (isMobile) document.body.style.overflow = 'unset';
    };
  }, [open, isMobile]);

  async function markRead(body: { ids?: string[]; all?: boolean }) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
    setReloadKey((k) => k + 1);
  }

  async function openItem(n: NotificationItem) {
    setOpen(false);
    if (!n.read_at) await markRead({ ids: [n.id] });
    if (n.link) router.push(n.link);
  }

  async function enablePush() {
    setEnabling(true);
    try {
      setPushState(await subscribeToPush());
    } finally {
      setEnabling(false);
    }
  }

  // Contenu commun au menu déroulant et au panneau mobile : invitation au push, liste
  const panelBody = (
    <>
      {pushState === 'default' && (
        <div className="px-4 py-2.5 bg-brand-500/5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <p className="text-[11px] text-slate-600 dark:text-slate-300">Être prévenu même quand le site est fermé.</p>
          <button
            type="button"
            onClick={enablePush}
            disabled={enabling}
            className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-60"
          >
            {enabling ? '…' : 'Activer'}
          </button>
        </div>
      )}
      {pushState === 'denied' && (
        <p className="px-4 py-2 text-[11px] text-slate-500 border-b border-slate-100 dark:border-slate-800">
          Notifications bloquées dans ce navigateur : autorisez-les dans les réglages du site pour les recevoir.
        </p>
      )}
      {pushState === 'ios-needs-install' && (
        <p className="px-4 py-2 text-[11px] text-slate-500 border-b border-slate-100 dark:border-slate-800 flex items-start gap-1.5">
          <Smartphone className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Sur iPhone : touchez « Partager » puis « Sur l&apos;écran d&apos;accueil » pour recevoir les notifications.
        </p>
      )}

      <ul
        className={cn(
          'overflow-y-auto overscroll-contain',
          isMobile ? 'flex-1 min-h-0 md-scroll p-3 space-y-2' : 'max-h-[60vh] divide-y divide-slate-100 dark:divide-slate-800',
        )}
      >
        {items.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-slate-500">Aucune notification pour le moment.</li>
        ) : (
          items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => openItem(n)}
                className={cn(
                  'w-full text-left flex gap-3 transition',
                  isMobile
                    ? cn(
                        'p-3.5 rounded-2xl border active:scale-[0.99] touch-manipulation',
                        n.read_at
                          ? 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
                          : 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/80',
                      )
                    : cn('px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60', !n.read_at && 'bg-brand-500/5'),
                )}
              >
                <span className={cn('mt-1.5 w-2 h-2 rounded-full shrink-0', n.read_at ? 'bg-transparent' : 'bg-brand-500')} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">{n.title}</span>
                  {n.body && <span className="block text-xs text-slate-600 dark:text-slate-400 mt-0.5">{n.body}</span>}
                  <span className={cn('block text-slate-400 mt-1', isMobile ? 'text-[11px]' : 'text-[10px]')}>{timeAgo(n.created_at)}</span>
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </>
  );

  return (
    <div className={cn('relative', className)} ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
        aria-label={unread > 0 ? `Notifications (${unread} non lue${unread > 1 ? 's' : ''})` : 'Notifications'}
        aria-expanded={open}
      >
        {unread > 0 ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open &&
        (isMobile ? (
          createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Notifications"
              onClick={() => setOpen(false)}
              className="fixed inset-0 flex flex-col justify-end items-center px-3.5 bg-slate-950/70 backdrop-blur-sm md-anim-fade"
              style={{ zIndex: 45 }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg h-auto max-h-[calc(100dvh-12rem)] flex flex-col overflow-hidden bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 md-anim-scale elevate-above-bottom-nav"
              >
                <div className="relative flex items-center justify-between gap-3 px-4 pt-3.5 pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                  <div
                    aria-hidden
                    className="absolute left-1/2 -translate-x-1/2 top-2.5 w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"
                  />
                  <div className="min-w-0 flex-1 pt-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Notifications</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est lu'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Fermer"
                    className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {unread > 0 && (
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <button
                      type="button"
                      onClick={() => markRead({ all: true })}
                      className="h-10 px-3 -ml-3 rounded-lg text-sm font-semibold text-brand-700 dark:text-brand-300 hover:bg-brand-500/10 flex items-center gap-1.5"
                    >
                      <CheckCheck className="w-4 h-4" /> Tout marquer comme lu
                    </button>
                  </div>
                )}
                {panelBody}
              </div>
            </div>,
            document.body,
          )
        ) : (
          <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-900 dark:text-white">Notifications</p>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => markRead({ all: true })}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-500 flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Tout marquer comme lu
                </button>
              )}
            </div>

            {panelBody}
          </div>
        ))}
    </div>
  );
}
