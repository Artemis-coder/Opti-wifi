'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Check, X, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const RULES = [
  { label: 'Au moins 8 caractères', test: (p: string) => p.length >= 8 },
  { label: 'Une majuscule', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Une minuscule', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Un chiffre', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Un caractère spécial', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const allRulesOk = RULES.every((r) => r.test(newPassword));
  const matches = newPassword.length > 0 && newPassword === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!allRulesOk) {
      setError('Le mot de passe ne respecte pas toutes les règles.');
      return;
    }
    if (!matches) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        setError(data.error || 'Erreur lors du changement de mot de passe.');
        setLoading(false);
        return;
      }
      router.refresh();
      router.replace(data.redirect || '/');
    } catch {
      setError('Erreur réseau. Réessayez.');
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login');
  }

  const toggle = (
    <button
      type="button"
      onClick={() => setShow((s) => !s)}
      className="text-slate-400 hover:text-slate-600"
      aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
    >
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="min-h-screen bg-brand-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brand-400/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/20 p-8 space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl mx-auto overflow-hidden relative shadow-lg border border-brand-500/30 flex items-center justify-center bg-brand-900">
            <Image src="/assets/logo.jpg" alt="OptiSpace" width={64} height={64} className="object-cover" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center justify-center gap-2">
            <KeyRound className="w-5 h-5 text-brand-500" />
            Choisissez votre mot de passe
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Vous vous êtes connecté avec un mot de passe temporaire. Pour sécuriser votre compte, créez votre propre
            mot de passe avant de continuer.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nouveau mot de passe"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            rightElement={toggle}
            required
          />

          <ul className="grid grid-cols-2 gap-1.5 text-[11px]">
            {RULES.map((r) => {
              const ok = r.test(newPassword);
              return (
                <li key={r.label} className={`flex items-center gap-1.5 ${ok ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  {r.label}
                </li>
              );
            })}
          </ul>

          <Input
            label="Confirmer le mot de passe"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={confirmPassword && !matches ? 'Les mots de passe ne correspondent pas.' : undefined}
            required
          />

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700" role="alert">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" isLoading={loading} disabled={!allRulesOk || !matches}>
            Enregistrer mon mot de passe
          </Button>
        </form>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
