'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, ArrowRight, Info, UserRoundPen, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { AccountNotice } from '@/lib/account-notices';

/** Événement à déclencher après une modification du compte pour rafraîchir le bandeau. */
export const ACCOUNT_NOTICES_REFRESH = 'account-notices:refresh';

const DISMISSED_KEY = 'account-notices:dismissed';

/** Avis masqués (« Plus tard ») pour une connexion donnée. */
interface Dismissed {
  session: string | null;
  ids: string[];
}

const TONES: Record<AccountNotice['tone'], { box: string; icon: string; button: string }> = {
  info: {
    box: 'bg-accent-soft',
    icon: 'bg-accent-soft text-accent',
    button: 'bg-accent hover:bg-accent-hover text-accent-foreground',
  },
  warning: {
    box: 'bg-warning-soft',
    icon: 'bg-warning-soft text-warning-soft-foreground',
    button: 'bg-warning hover:bg-warning-hover text-foreground',
  },
  danger: {
    box: 'bg-danger-soft',
    icon: 'bg-danger-soft text-danger',
    button: 'bg-danger hover:bg-danger-hover text-danger-foreground',
  },
};

function readDismissed(): Dismissed {
  if (typeof window === 'undefined') return { session: null, ids: [] };
  try {
    const value = JSON.parse(localStorage.getItem(DISMISSED_KEY) || 'null');
    return value && Array.isArray(value.ids) ? value : { session: null, ids: [] };
  } catch {
    return { session: null, ids: [] };
  }
}

/**
 * Bandeau en haut de l'espace client : informations du compte à compléter, abonnement qui
 * se termine… (avis calculés par /api/account/notices). « Plus tard » masque un avis
 * pour la connexion en cours seulement : il réapparaît à chaque nouvelle connexion.
 */
export function AccountNotices() {
  const pathname = usePathname();
  const [notices, setNotices] = useState<AccountNotice[]>([]);
  const [session, setSession] = useState<string | null>(null);
  // Le bandeau n'apparaît qu'une fois les avis chargés (après le rendu serveur) : pas de décalage d'hydratation
  const [dismissed, setDismissed] = useState<Dismissed>(readDismissed);

  const load = useCallback(() => {
    fetch('/api/account/notices')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res) => {
        setNotices(res.data || []);
        setSession(res.session ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(ACCOUNT_NOTICES_REFRESH, load);
    return () => window.removeEventListener(ACCOUNT_NOTICES_REFRESH, load);
  }, [load]);

  // Un « Plus tard » d'une connexion précédente ne compte plus
  const dismissedIds = session && dismissed.session === session ? dismissed.ids : [];

  const dismiss = (id: string) => {
    const next: Dismissed = { session, ids: [...new Set([...dismissedIds, id])] };
    setDismissed(next);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  };

  const visible = notices.filter((n) => !dismissedIds.includes(n.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-5 mb-4 sm:mb-6" role="region" aria-label="Informations du compte">
      {visible.map((n) => {
        const tone = TONES[n.tone];
        const Icon = n.id.startsWith('profile.') ? UserRoundPen : n.tone === 'info' ? Info : AlertTriangle;
        // Inutile de proposer le lien vers la page où l'on se trouve déjà
        const onTarget = n.action && pathname === n.action.href.split('?')[0];
        return (
          <div
            key={n.id}
            className={cn('flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border px-4 py-3', tone.box)}
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <span className={cn('w-9 h-9 shrink-0 rounded-lg flex items-center justify-center', tone.icon)}>
                <Icon className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{n.title}</p>
                <p className="text-xs text-muted mt-0.5">{n.message}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:shrink-0 pl-12 sm:pl-0">
              {n.action && !onTarget && (
                <Link
                  href={n.action.href}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-xl px-3.5 h-9 text-xs font-semibold transition',
                    tone.button
                  )}
                >
                  {n.action.label}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
              <button
                type="button"
                onClick={() => dismiss(n.id)}
                className="inline-flex items-center gap-1 rounded-xl px-2.5 h-9 text-xs font-semibold text-muted hover:text-foreground hover:bg-white/60"
                aria-label={`Masquer : ${n.title}`}
              >
                <X className="w-3.5 h-3.5" />
                Plus tard
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
