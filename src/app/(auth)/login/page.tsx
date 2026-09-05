'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/lib/stores/authStore';
import { UserRole } from '@/types/database';

type Mode = 'login' | 'register' | 'recovery';

function RecoveryHandler({
  onModeChange,
  onRecoveryReady,
}: {
  onModeChange: (mode: Mode) => void;
  onRecoveryReady: (ready: boolean) => void;
}) {
  const supabase = createClient();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function handleRecovery() {
      const type = searchParams.get('type');
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');

      if (type === 'recovery' && accessToken && refreshToken) {
        onModeChange('recovery');
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          console.error('Recovery session error:', sessionError);
        } else {
          onRecoveryReady(true);
        }
      }
    }

    handleRecovery();
  }, [searchParams, supabase.auth, onModeChange, onRecoveryReady]);

  return null;
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nom, setNom] = useState('');
  const [orgName, setOrgName] = useState('');
  const [role, setRole] = useState<UserRole>('administrateur');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [recoveryReady, setRecoveryReady] = useState(false);

  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message || 'Email ou mot de passe incorrect.');
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profile) {
        setUser(profile);
      } else {
        // The profile query failed or returned no rows.
        // Determine the correct role from auth metadata instead of defaulting to collecteur.
        const authRole = data.user.user_metadata?.role || data.user.app_metadata?.role;
        const isAdminFromAuth = authRole === 'administrateur';

        const fallbackProfile = {
          id: data.user.id,
          nom: data.user.email?.split('@')[0] || 'Utilisateur',
          email: data.user.email || '',
          role: (isAdminFromAuth ? 'administrateur' : 'collecteur') as UserRole,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        console.warn('Profile not found in DB for user:', data.user.id, '- falling back to auth metadata role:', fallbackProfile.role);
        console.warn('Profile query error:', profileError?.message);

        setUser(fallbackProfile);
      }

      // Check if user is a platform super admin
      const { data: platformUser } = await supabase
        .from('platform_users')
        .select('role')
        .eq('auth_user_id', data.user.id)
        .eq('is_active', true)
        .single();

      if (platformUser && (platformUser.role === 'super_admin' || platformUser.role === 'platform_support')) {
        router.push('/platform/dashboard');
      } else {
        router.push('/dashboard');
      }
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message || 'Erreur lors de la mise à jour du mot de passe.');
    } else {
      await supabase.auth.signOut();
      setSuccessMsg('Mot de passe mis à jour avec succès ! Vous pouvez vous connecter.');
      setMode('login');
      setNewPassword('');
      setConfirmPassword('');
      setRecoveryReady(false);
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom || !email || !password || !orgName) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nom, orgName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erreur lors de la création du compte.');
        setLoading(false);
        return;
      }

      setSuccessMsg(data.message || '✅ Compte créé avec succès ! En attente de validation.');
      // Switch back to login mode so they know they have to wait or can try logging in
      setTimeout(() => {
        setMode('login');
        setLoading(false);
      }, 3000);
      
    } catch (err: unknown) {
      console.error('Registration error:', err);
      setError('Erreur de connexion au serveur.');
      setLoading(false);
    }
  };

  const showTabs = mode === 'login' || mode === 'register';

  return (
    <div className="min-h-screen bg-[#0b1a3a] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/20 p-8 space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl mx-auto overflow-hidden relative shadow-lg border border-amber-500/30 flex items-center justify-center bg-[#0b1a3a]">
            <Image src="/assets/logo.jpg" alt="OptiWifi" width={64} height={64} className="object-cover" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Opti<span className="text-amber-500">Wifi</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Plateforme de Gestion des Tickets & Encaissements Wi-Fi
          </p>
        </div>

        <Suspense fallback={null}>
          <RecoveryHandler
            onModeChange={setMode}
            onRecoveryReady={setRecoveryReady}
          />
        </Suspense>

        {showTabs && (
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Se Connecter
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                mode === 'register'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Créer un Compte
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200 font-medium">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs border border-emerald-200 font-medium">
            {successMsg}
          </div>
        )}

        {mode === 'login' && !recoveryReady && (
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Adresse Email"
              type="email"
              placeholder="votre.email@exemple.ci"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Mot de Passe"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button
              type="button"
              onClick={() => { setMode('recovery'); setError(''); setSuccessMsg(''); }}
              className="text-xs text-amber-600 hover:text-amber-700 font-semibold"
            >
              Mot de passe oublié ?
            </button>

            <Button type="submit" className="w-full h-11 text-sm font-bold" isLoading={loading}>
              Se connecter à mon espace
            </Button>
          </form>
        )}

        {mode === 'recovery' && (
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white text-center">
              Réinitialiser mon mot de passe
            </h2>
            <p className="text-xs text-slate-500 text-center">
              Définissez un nouveau mot de passe pour votre compte.
            </p>

            <Input
              label="Nouveau mot de passe"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <Input
              label="Confirmer le mot de passe"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            <Button type="submit" variant="secondary" className="w-full h-11 text-sm font-bold" isLoading={loading}>
              Mettre à jour le mot de passe
            </Button>

            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); setNewPassword(''); setConfirmPassword(''); setRecoveryReady(false); }}
              className="w-full text-xs text-slate-500 hover:text-slate-700 font-semibold"
            >
              Retour à la page de connexion
            </button>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <Input
              label="Nom de l'Entreprise"
              type="text"
              placeholder="ex: Boris Wifi"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
            />
            <Input
              label="Nom Complet du Gérant"
              type="text"
              placeholder="ex: Yao Brice"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
            />
            <Input
              label="Adresse Email"
              type="email"
              placeholder="votre.email@exemple.ci"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Mot de Passe (6+ caractères)"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button type="submit" variant="secondary" className="w-full h-11 text-sm font-bold" isLoading={loading}>
              Créer mon Compte
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
