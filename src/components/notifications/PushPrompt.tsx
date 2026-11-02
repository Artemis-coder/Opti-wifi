'use client';

import React, { useEffect, useState } from 'react';
import { Bell, BellRing, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { getPushState, isPushSupported, isStandalone, subscribeToPush } from '@/lib/push-client';

const LATER_DAYS = 7;
const storageKey = (userId: string) => `optispace:push-prompt:${userId}`;

const TEXT = {
  client: {
    title: 'Activer les notifications ?',
    body: 'Soyez prévenu sur ce téléphone, même application fermée : nouvelles collectes de votre équipe, fin de licence, réponses du support.',
  },
  platform: {
    title: 'Activer les notifications ?',
    body: 'Soyez prévenu sur ce téléphone, même application fermée : nouvelles inscriptions, demandes de licence, messages au support et alertes de l’état du système.',
  },
};

/**
 * Application installée (écran d'accueil) : à la première ouverture après connexion, propose
 * d'activer les notifications push. La demande du système s'affiche au clic sur « Activer »
 * (obligatoire sur iPhone). « Plus tard » : reproposé dans 7 jours.
 */
export function PushPrompt({ userId, audience }: { userId: string | null | undefined; audience: 'client' | 'platform' }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;
    if (!isStandalone() || !isPushSupported()) return;
    const later = Number(localStorage.getItem(storageKey(userId)) || 0);
    if (later && Date.now() - later < LATER_DAYS * 24 * 3600 * 1000) return;
    let cancelled = false;
    // Laisse l'espace s'afficher avant de proposer
    const timer = setTimeout(() => {
      getPushState()
        .then((state) => !cancelled && state === 'default' && setOpen(true))
        .catch(() => {});
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userId]);

  if (!open || !userId) return null;

  const later = () => {
    localStorage.setItem(storageKey(userId), String(Date.now()));
    setOpen(false);
  };

  const activate = async () => {
    setBusy(true);
    try {
      const state = await subscribeToPush();
      if (state === 'subscribed') {
        toast.success('Notifications activées sur cet appareil.');
        localStorage.removeItem(storageKey(userId));
      } else if (state === 'denied') {
        toast.error('Notifications refusées. Vous pourrez les autoriser dans les réglages du téléphone, puis depuis la cloche.');
        localStorage.setItem(storageKey(userId), String(Date.now()));
      } else {
        toast('Notifications non activées. Vous pourrez le faire depuis la cloche.');
        localStorage.setItem(storageKey(userId), String(Date.now()));
      }
    } catch {
      toast.error('Activation impossible pour le moment. Réessayez depuis la cloche.');
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const t = TEXT[audience];
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-950/50 p-3" role="dialog" aria-modal="true" aria-labelledby="push-prompt-title">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 shadow-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] relative">
        <button
          type="button"
          onClick={later}
          aria-label="Fermer"
          className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950/40 text-brand-600 flex items-center justify-center mb-4">
          <BellRing className="w-7 h-7" />
        </div>
        <h2 id="push-prompt-title" className="text-lg font-bold text-slate-900 dark:text-white">
          {t.title}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t.body}</p>
        <p className="mt-2 text-xs text-slate-500">Votre téléphone va vous demander l’autorisation : choisissez « Autoriser ».</p>
        <div className="mt-5 grid grid-cols-1 gap-2">
          <Button className="h-12 font-semibold" icon={Bell} isLoading={busy} onClick={activate}>
            Activer les notifications
          </Button>
          <Button variant="ghost" className="h-11" onClick={later} disabled={busy}>
            Plus tard
          </Button>
        </div>
      </div>
    </div>
  );
}
