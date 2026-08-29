import React from 'react';
import { View } from '@/tw';
import { cn } from './Button';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <View className={cn('bg-white rounded-2xl p-4 shadow-sm border border-gray-100', className)}>
      {children}
    </View>
  );
}
