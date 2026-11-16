import React from 'react';
import { chipVariants } from '@heroui/styles';
import { cn } from '@/lib/utils/cn';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

const COLOR = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'accent',
  neutral: 'default',
} as const;

/** Étiquette d'état au style HeroUI Chip (variante soft). */
export function Badge({ className, variant = 'neutral', children, ...props }: BadgeProps) {
  return (
    <span className={cn(chipVariants({ color: COLOR[variant], variant: 'soft', size: 'sm' }).base(), className)} {...props}>
      {children}
    </span>
  );
}
