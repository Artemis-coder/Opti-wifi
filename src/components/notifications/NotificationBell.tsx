'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellRing, CheckCheck, Smartphone } from 'lucide-react';
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

const POLL_MS = 30_000;

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

export function NotificationBell({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [pushState, setPushState] = useState<PushState>('unsupported');
  const [enabling, setEnabling] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Chargement + rafraîchissement périodique (suspendu quand l'onglet est masqué)
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (document.visibilityState === 'hidden') return;
      fetch('/api/notifications?limit=20')
        .then((res) => (res.ok ? res.json() : null))
        .then((res) => {
          if (cancelled || !res) return;
          setItems(res.data || []);
          setUnread(res.unread || 0);
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, POLL_MS);
    document.addEventListener('visibilitychange', load);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, [reloadKey]);

  useEffect(() => {
    getPushState().then(setPushState).catch(() => setPushState('unsupported'));
  }, []);

  // Fermer en cliquant à l'extérieur
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

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

      {open && (
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

          <ul className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-xs text-slate-500">Aucune notification pour le moment.</li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition flex gap-3',
                      !n.read_at && 'bg-brand-500/5'
                    )}
                  >
                    <span className={cn('mt-1.5 w-2 h-2 rounded-full shrink-0', n.read_at ? 'bg-transparent' : 'bg-brand-500')} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-900 dark:text-white">{n.title}</span>
                      {n.body && <span className="block text-xs text-slate-600 dark:text-slate-400 mt-0.5">{n.body}</span>}
                      <span className="block text-[10px] text-slate-400 mt-1">{timeAgo(n.created_at)}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
