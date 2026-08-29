import React from 'react';
import { Pressable, Text, useCSSVariable } from '@/tw';
import { ActivityIndicator, PressableProps } from 'react-native';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends PressableProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  label: string;
  loading?: boolean;
  className?: string;
  textClassName?: string;
}

export const Button = React.forwardRef<any, ButtonProps>(
  ({ variant = 'primary', size = 'md', label, loading, className, textClassName, disabled, ...props }, ref) => {
    const isPrimary = variant === 'primary';
    const isSecondary = variant === 'secondary';
    const isGhost = variant === 'ghost';
    const isDanger = variant === 'danger';

    return (
      <Pressable
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'flex-row items-center justify-center rounded-xl active:scale-[0.98] transition-transform gap-2',
          {
            'bg-blue-600 active:bg-blue-700': isPrimary,
            'bg-gray-100 active:bg-gray-200': isSecondary,
            'bg-transparent active:bg-gray-100': isGhost,
            'bg-red-600 active:bg-red-700': isDanger,
            'h-10 px-4': size === 'sm',
            'h-12 px-6': size === 'md',
            'h-14 px-8': size === 'lg',
            'opacity-50': disabled,
          },
          className
        )}
        {...props}
      >
        {loading ? (
          <ActivityIndicator color={isPrimary || isDanger ? 'white' : '#2563EB'} />
        ) : (
          <>
            {props.children}
            {label ? (
              <Text
                className={cn(
                  'font-poppins-semibold',
                  {
                    'text-white': isPrimary || isDanger,
                    'text-gray-900': isSecondary,
                    'text-blue-600': isGhost,
                    'text-sm': size === 'sm',
                    'text-base': size === 'md',
                    'text-lg': size === 'lg',
                  },
                  textClassName
                )}
              >
                {label}
              </Text>
            ) : null}
          </>
        )}
      </Pressable>
    );
  }
);
Button.displayName = 'Button';
