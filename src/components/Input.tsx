import React, { useState } from 'react';
import { View, Text, TextInput } from '@/tw';
import { cn } from './Button';
import { TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  className?: string;
}

export const Input = React.forwardRef<any, InputProps>(
  ({ label, error, helperText, className, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <View className={cn('w-full', className)}>
        {label && (
          <Text className="font-poppins-medium text-sm text-gray-700 mb-1.5">
            {label}
          </Text>
        )}
        <TextInput
          ref={ref}
          className={cn(
            'h-12 px-4 rounded-xl border font-poppins-regular text-base text-gray-900 bg-gray-50',
            {
              'border-gray-200': !isFocused && !error,
              'border-blue-500 bg-white': isFocused && !error,
              'border-red-500 bg-red-50': error,
            }
          )}
          placeholderTextColor="#9CA3AF"
          onFocus={(e: any) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e: any) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />
        {error ? (
          <Text className="font-poppins-regular text-xs text-red-500 mt-1.5">
            {error}
          </Text>
        ) : helperText ? (
          <Text className="font-poppins-regular text-xs text-gray-500 mt-1.5">
            {helperText}
          </Text>
        ) : null}
      </View>
    );
  }
);
Input.displayName = 'Input';
