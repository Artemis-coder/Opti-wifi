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
import { Eye, EyeOff } from 'lucide-react';

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
   const [showLoginPassword, setShowLoginPassword] = useState(false);
   const [showRegisterPassword, setShowRegisterPassword] = useState(false);
   const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
   const [showRecoveryConfirmPassword, setShowRecoveryConfirmPassword] = useState(false);

  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Identifiants invalides.');
        setLoading(false);
        return;
      }

      // data contains { user, session }
      const { user } = data;
      setUser(user);

      // La page racine redirige selon le rôle (super admin → /platform, client → /dashboard)
      router.refresh();
      router.push('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue.';
      setError(message);
      setLoading(false);
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
    <div className="min-h-screen bg-brand-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brand-400/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/20 p-8 space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl mx-auto overflow-hidden relative shadow-lg border border-brand-500/30 flex items-center justify-center bg-brand-900">
            <Image src="/assets/logo.jpg" alt="OptiSpace" width={64} height={64} className="object-cover" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Opti<span className="text-brand-500">Space</span>
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
              className={`md-ripple tap-target flex-1 text-xs sm:text-sm font-bold rounded-xl transition-colors ${
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
              className={`md-ripple tap-target flex-1 text-xs sm:text-sm font-bold rounded-xl transition-colors ${
                mode === 'register'
                  ? 'bg-brand-500 text-brand-on font-bold shadow-xs'
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
              type={showLoginPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  className="tap-target p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors focus:outline-none flex items-center justify-center rounded-lg"
                  aria-label={showLoginPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  tabIndex={-1}
                >
                  {showLoginPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              }
            />

            <a
              href="/forgot-password"
              className="md-ripple text-brand-600 hover:text-brand-700 font-semibold text-sm py-3 px-2 -ml-2 block text-center"
            >
              Mot de passe oublié ?
            </a>

            <Button type="submit" className="w-full h-12 sm:h-11 text-sm font-bold" isLoading={loading}>
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
              type={showRecoveryPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowRecoveryPassword((prev) => !prev)}
                  className="tap-target p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors focus:outline-none flex items-center justify-center rounded-lg"
                  aria-label={showRecoveryPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  tabIndex={-1}
                >
                  {showRecoveryPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              }
            />
            <Input
              label="Confirmer le mot de passe"
              type={showRecoveryConfirmPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowRecoveryConfirmPassword((prev) => !prev)}
                  className="tap-target p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors focus:outline-none flex items-center justify-center rounded-lg"
                  aria-label={showRecoveryConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  tabIndex={-1}
                >
                  {showRecoveryConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              }
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
              type={showRegisterPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowRegisterPassword((prev) => !prev)}
                  className="tap-target p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors focus:outline-none flex items-center justify-center rounded-lg"
                  aria-label={showRegisterPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  tabIndex={-1}
                >
                  {showRegisterPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              }
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
