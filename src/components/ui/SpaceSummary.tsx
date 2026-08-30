import React from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface SpaceSummaryProps {
  spaceName: string;
  spaceCount?: number;
  className?: string;
}

export function SpaceSummary({ spaceName, spaceCount, className }: SpaceSummaryProps) {
  return (
    <div className={cn(
      'flex items-center gap-2',
      className
    )}>
      <MapPin className="w-4 h-4 text-amber-400" />
      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
        {spaceName}
      </span>
      {spaceCount !== undefined && (
        <span className="text-xs text-slate-500">
          ({spaceCount})
        </span>
      )}
    </div>
  );
}