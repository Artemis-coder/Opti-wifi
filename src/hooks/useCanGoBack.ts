'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

/**
 * True when the router has somewhere to go back to.
 *
 * Next.js stores a monotonically increasing `idx` in each history entry.
 * `history.length` is useless here: it also counts the entry the user
 * arrived on, so it can never distinguish "at the root" from "drilled in".
 *
 * The snapshot is re-read on every render (any navigation refreshes it) and
 * the popstate subscription keeps it correct for back/forward gestures,
 * including Android's system back button.
 */
export function useCanGoBack(): boolean {
  // Reading the pathname subscribes this component to navigations.
  usePathname();

  return React.useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('popstate', onStoreChange);
      return () => window.removeEventListener('popstate', onStoreChange);
    },
    () => ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0,
    () => false
  );
}
