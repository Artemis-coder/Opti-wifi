import React from 'react';
import { cn } from '@/lib/utils/cn';

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 transition hover:shadow-md',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
