'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { useReadOnly } from '@/lib/stores/accessStore';
import { READ_ONLY_HINT } from '@/lib/read-only';

/**
 * Bouton qui ajoute, modifie ou supprime des données : désactivé (avec explication) quand
 * l'espace est en consultation seule (abonnement expiré).
 */
export const WriteButton = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
  ({ disabled, title, ...props }, ref) => {
    const readOnly = useReadOnly();
    return <Button ref={ref} {...props} disabled={disabled || readOnly} title={readOnly ? READ_ONLY_HINT : title} />;
  }
);
WriteButton.displayName = 'WriteButton';

/** Pour un bouton ou un lien maison : { disabled, title } à appliquer en consultation seule. */
export function useWriteLock() {
  const readOnly = useReadOnly();
  return { locked: readOnly, title: readOnly ? READ_ONLY_HINT : undefined };
}
