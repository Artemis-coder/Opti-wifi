import React from 'react';
import { Store } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface PosSummaryProps {
  linkedPosCount: number;
  activePosCount?: number;
  className?: string;
}

export function PosSummary({ linkedPosCount, activePosCount, className }: PosSummaryProps) {
  const activeLabel = activePosCount !== undefined
    ? `(${activePosCount} actif${activePosCount > 1 ? 's' : ''})`
    : '';

  return (
    <div className={cn(
      'flex items-center gap-3',
      className
    )}>
      <div className="p-2 rounded-xl bg-accent-soft text-accent">
        <Store className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-muted">
          Points de Vente rattachés
        </p>
        <p className="text-xs text-muted">
          {linkedPosCount} POS {activeLabel}
        </p>
      </div>
    </div>
  );
}