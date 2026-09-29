'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useNetworkPanel, TONE_SURFACE } from '@/hooks/useNetworkPanel';
import { NetworkDetailsSheet } from '@/components/offline/NetworkDetailsSheet';
import { cn } from '@/lib/utils/cn';

const STANDALONE_ROUTES = new Set(['/', '/login', '/platform/login']);

/**
 * Root-layout mount point. The indicator lives in the bottom navigation bar
 * everywhere else, so it is only rendered here for screens that have no bar.
 */
export function StandaloneConnectionStatus() {
  const pathname = usePathname();
  if (pathname && STANDALONE_ROUTES.has(pathname)) {
    return <ConnectionStatus />;
  }
  return null;
}

/**
 * Floating variant, for screens that have no bottom navigation bar (login).
 * Inside the app the indicator lives in the navigation bar instead.
 */
export function ConnectionStatus() {
  const panel = useNetworkPanel();
  const Icon = panel.icon;
  const isChecking = panel.label === 'Vérification…';

  return (
    <>
      <div className="app-net-anchor-standalone fixed right-3 z-50">
        <button
          type="button"
          onClick={() => panel.setDetailsOpen(true)}
          aria-haspopup="dialog"
          aria-label={`Connexion ${panel.label}. Voir les détails réseau`}
          className={cn(
            'md-ripple inline-flex h-10 items-center gap-2 rounded-full border md-elevation-2',
            panel.showLabel ? 'pl-3 pr-4' : 'w-10 justify-center',
            TONE_SURFACE[panel.tone]
          )}
        >
          <Icon className={cn('w-4 h-4 shrink-0', isChecking && 'animate-spin')} />
          {panel.showLabel && (
            <span className="text-[12px] font-semibold leading-none">{panel.label}</span>
          )}
        </button>
      </div>

      <NetworkDetailsSheet panel={panel} />
    </>
  );
}
