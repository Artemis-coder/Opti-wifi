import React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Surface de contenu au style HeroUI (bg-surface + shadow-surface, sans bordure).
 * Mise en page libre (bloc) pour rester compatible avec les pages existantes ;
 * pour un nouvel écran, préférer `Card` de `@heroui/react` (Card.Header, Card.Content…).
 */
export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-2xl bg-surface p-4 sm:p-5 text-surface-foreground shadow-surface', className)} {...props}>
      {children}
    </div>
  );
}
