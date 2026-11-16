import React from 'react';
import { Avatar } from '@heroui/react';

/** Deux initiales lisibles à partir d'un nom (ou d'une adresse e-mail en secours). */
export function userInitials(name?: string | null, email?: string | null): string {
  const source = (name || '').trim() || (email || '').split('@')[0] || '';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const second = parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] ?? '';
  return (first + second).toUpperCase();
}

interface UserAvatarProps {
  name?: string | null;
  email?: string | null;
  /** Compte bloqué / banni : avatar rouge */
  danger?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** Avatar d'utilisateur du design system (HeroUI Avatar, initiales sur fond doux). */
export function UserAvatar({ name, email, danger, size = 'sm', className }: UserAvatarProps) {
  return (
    <Avatar size={size} variant="soft" color={danger ? 'danger' : 'accent'} className={className}>
      <Avatar.Fallback>{userInitials(name, email)}</Avatar.Fallback>
    </Avatar>
  );
}
