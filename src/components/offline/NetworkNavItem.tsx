'use client';

import React from 'react';
import { useNetworkPanel, TONE_SURFACE } from '@/hooks/useNetworkPanel';
import { NetworkDetailsSheet } from '@/components/offline/NetworkDetailsSheet';
import { cn } from '@/lib/utils/cn';

/**
 * Trailing slot of the bottom navigation bar: a compact, always visible
 * network indicator. Tapping it opens the full diagnostics sheet.
 */
export function NetworkNavItem() {
  const panel = useNetworkPanel();
  const Icon = panel.icon;
  const isChecking = panel.label === 'Vérification…';

  return (
    <>
      <button
        type="button"
        onClick={() => panel.setDetailsOpen(true)}
        aria-label={`Connexion ${panel.label}. Voir les détails réseau`}
        aria-haspopup="dialog"
        className="md-ripple relative flex w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl py-1.5 transition-colors duration-200"
      >
        <span
          className={cn(
            'flex h-8 w-12 items-center justify-center rounded-full border transition-colors duration-200',
            TONE_SURFACE[panel.tone]
          )}
        >
          <Icon className={cn('h-5 w-5 shrink-0', isChecking && 'animate-spin')} />
        </span>
        <span className="max-w-full truncate px-0.5 text-center text-[10px] font-medium leading-4 text-slate-300">
          Réseau
        </span>

        {panel.pendingCount > 0 && (
          <span className="absolute right-2 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-slate-950">
            {panel.pendingCount > 9 ? '9+' : panel.pendingCount}
          </span>
        )}
      </button>

      <NetworkDetailsSheet panel={panel} />
    </>
  );
}
