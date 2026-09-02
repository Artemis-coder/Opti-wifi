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
  const [role, setRole] = useState<UserRole>('collecteur');

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
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profile) {
        setUser(profile);
      } else {
        const newProfile = {
          id: data.user.id,
          nom: data.user.email?.split('@')[0] || 'Utilisateur',
          email: data.user.email || '',
           role: 'collecteur' as UserRole,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setUser(newProfile);
      }

      router.push('/dashboard');
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
    if (!nom || !email || !password) {
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

    const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined;

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { nom, role },
      },
    });

    if (signUpError) {
      if (
        signUpError.message?.toLowerCase().includes('already registered') ||
        signUpError.code === 'email_provider_disabled' ||
        signUpError.message?.toLowerCase().includes('disabled')
      ) {
        const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });
        if (signInData?.user) {
          const { data: existingProfile } = await supabase
            .from('profiles').select('*').eq('id', signInData.user.id).single();
          setUser(existingProfile ?? { id: signInData.user.id, nom, email, role, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
          setSuccessMsg('Connexion réussie ! Redirection...');
          setTimeout(() => router.push('/dashboard'), 500);
          return;
        }
      }
      setError(signUpError.message || 'Erreur lors de la création du compte.');
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError || !signInData?.session) {
        setError('Compte créé. Veuillez vous connecter avec vos identifiants.');
        setLoading(false);
        return;
      }

      const profileData = {
        id: data.user.id,
        nom: nom.trim(),
        email: email.trim().toLowerCase(),
        role: role,
        updated_at: new Date().toISOString(),
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' });

      if (profileError) {
        console.warn('Profile upsert warning:', profileError.message);
      }

      const { data: savedProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      const finalProfile = savedProfile ?? { ...profileData, created_at: new Date().toISOString() };

      setUser(finalProfile);
      setSuccessMsg('✅ Compte créé avec succès ! Redirection vers votre espace...');
      setTimeout(() => router.push('/dashboard'), 800);
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
              label="Nom Complet"
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

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Rôle / Type de Compte
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium"
              >
                <option value="administrateur">👑 Administrateur (Gestion Totale)</option>
                <option value="collecteur">💼 Collecteur / Agent Terrain</option>
              </select>
            </div>

            <Button type="submit" variant="secondary" className="w-full h-11 text-sm font-bold" isLoading={loading}>
              Créer mon Compte
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
