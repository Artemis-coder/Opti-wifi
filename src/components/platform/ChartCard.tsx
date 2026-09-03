import React from 'react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils/cn';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, children, className }: ChartCardProps) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </Card>
  );
}
