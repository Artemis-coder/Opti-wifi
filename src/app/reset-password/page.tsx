'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tokenFromParams = searchParams.get('token');
    if (tokenFromParams) {
      setToken(tokenFromParams);
    } else {
      toast.error('Lien de réinitialisation invalide ou expiré');
      router.push('/login');
    }
  }, [searchParams, router, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error('Lien de réinitialisation invalide');
      return;
    }

    if (password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Échec de la réinitialisation du mot de passe');
      }

      toast.success('Mot de passe mis à jour avec succès. Vous pouvez maintenant vous connecter.');
      router.push('/login');
    } catch (error: any) {
      toast.error(error.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl mx-auto overflow-hidden relative shadow-lg border border-brand-500/30 flex items-center justify-center bg-brand-900">
          <img src="/assets/logo.jpg" alt="OptiSpace" width={64} height={64} className="object-cover" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Opti<span className="text-brand-500">Space</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Réinitialisation de mot de passe
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            Nouveau mot de passe
          </label>
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full h-14 sm:h-11 px-4 sm:px-3.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition duration-150"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            Confirmer le mot de passe
          </label>
          <Input
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full h-14 sm:h-11 px-4 sm:px-3.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition duration-150"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`md-ripple inline-flex items-center justify-center gap-2 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-brand-500 text-brand-on hover:bg-brand-600 md-elevation-1 px-4 rounded-xl w-full h-12 sm:h-11 text-sm font-bold ${loading ? 'opacity-50' : ''}`}
        >
          {loading ? 'Mise à jour...' : 'Réinitialiser le mot de passe'}
        </button>
      </form>

      <div className="text-center text-xs text-slate-500">
        <p className="mt-4">
          Vous n&apos;avez pas demandé cette réinitialisation ? <a href="/login" className="text-brand-500 hover:underline">Connectez-vous plutôt</a>.
        </p>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-brand-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brand-400/10 rounded-full blur-3xl" />

      <Suspense fallback={
        <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/20 p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      }>
        <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/20 p-8 space-y-6">
          <ResetPasswordForm />
        </div>
      </Suspense>
    </div>
  );
}