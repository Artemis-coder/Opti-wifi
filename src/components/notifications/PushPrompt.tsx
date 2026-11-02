'use client';

import React, { useEffect, useState } from 'react';
import { Bell, BellRing, PlusSquare, Share, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { isPushSupported, needsInstallForPush, subscribeToPush } from '@/lib/push-client';

const LATER_DAYS = 7;
const storageKey = (userId: string) => `optispace:push-prompt:${userId}`;

const TEXT = {
  client: {
    title: 'Activer les notifications ?',
    body: 'Soyez prévenu sur cet appareil, même application fermée : nouvelles collectes de votre équipe, fin de licence, réponses du support.',
  },
  collector: {
    title: 'Activer les notifications ?',
    body: 'Soyez prévenu sur cet appareil, même application fermée : messages de votre administrateur, réponses du support et informations sur votre espace.',
  },
  platform: {
    title: 'Activer les notifications ?',
    body: 'Soyez prévenu sur cet appareil, même application fermée : nouvelles inscriptions, demandes de licence, messages au support et alertes de l’état du système.',
  },
};

type Mode = 'enable' | 'install';

/**
 * Pour tous (administrateur, collecteur, super admin), sur téléphone comme sur ordinateur,
 * dans le navigateur ou l'application installée : à la première ouverture après connexion,
 * propose d'activer les notifications push. La demande du système s'affiche au
 * clic sur « Activer » (obligatoire sur iPhone). Sur iPhone dans Safari, où les notifications
 * n'existent pas, explique comment installer l'application.
 * « Plus tard » : reproposé dans 7 jours ; jamais si déjà autorisées ou refusées.
 */
export function PushPrompt({ userId, audience }: { userId: string | null | undefined; audience: 'client' | 'collector' | 'platform' }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const open = mode !== null;

  useEffect(() => {
    if (!userId || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;
    const later = Number(localStorage.getItem(storageKey(userId)) || 0);
    if (later && Date.now() - later < LATER_DAYS * 24 * 3600 * 1000) return;

    // Décision sans attendre le service worker : seule l'autorisation compte
    let next: Mode | null = null;
    if (isPushSupported()) {
      if (Notification.permission === 'default') next = 'enable';
    } else if (needsInstallForPush()) {
      next = 'install';
    }
    if (!next) return;
    // Laisse l'espace s'afficher avant de proposer
    const timer = setTimeout(() => setMode(next), 1500);
    return () => clearTimeout(timer);
  }, [userId]);

  if (!open || !userId) return null;

  const later = () => {
    localStorage.setItem(storageKey(userId), String(Date.now()));
    setMode(null);
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
      setMode(null);
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
          {mode === 'install' ? 'Recevoir les notifications sur iPhone' : t.title}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t.body}</p>
        {mode === 'install' ? (
          <>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Sur iPhone, les notifications ne fonctionnent que depuis l’application installée :
            </p>
            <ol className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center justify-center shrink-0">1</span>
                Touchez <Share className="w-4 h-4 text-brand-600 shrink-0" aria-label="Partager" /> <strong>Partager</strong> dans Safari
              </li>
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center justify-center shrink-0">2</span>
                Choisissez <PlusSquare className="w-4 h-4 text-brand-600 shrink-0" aria-hidden /> <strong>Sur l’écran d’accueil</strong>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center justify-center shrink-0">3</span>
                Ouvrez OptiSpace depuis l’icône : l’activation vous sera proposée
              </li>
            </ol>
            <div className="mt-5">
              <Button className="w-full h-12 font-semibold" onClick={later}>
                J’ai compris
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-xs text-slate-500">Votre appareil va vous demander l’autorisation : choisissez « Autoriser ».</p>
            <div className="mt-5 grid grid-cols-1 gap-2">
              <Button className="h-12 font-semibold" icon={Bell} isLoading={busy} onClick={activate}>
                Activer les notifications
              </Button>
              <Button variant="ghost" className="h-11" onClick={later} disabled={busy}>
                Plus tard
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
