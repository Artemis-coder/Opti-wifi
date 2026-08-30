'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/lib/stores/authStore';
import { UserRole } from '@/types/database';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Form fields
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('administrateur');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

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
          role: 'administrateur' as UserRole,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setUser(newProfile);
      }

      router.push('/dashboard');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetLoading(true);
    setError('');
    setSuccessMsg('');

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/login`,
    });

    if (resetError) {
      setError(resetError.message || 'Erreur lors de l\'envoi du lien de réinitialisation.');
    } else {
      setSuccessMsg('Lien de réinitialisation envoyé ! Vérifiez votre email.');
      setResetEmail('');
    }
    setResetLoading(false);
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

    // ÉTAPE 1 : Création du compte Supabase Auth
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { nom, role }, // Transmis au trigger handle_new_user
      },
    });

    if (signUpError) {
      // Cas spécial : email déjà inscrit ou provider désactivé → tentative de login
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
      // ÉTAPE 2 : Connexion immédiate pour établir la session JWT
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError || !signInData?.session) {
        setError('Compte créé. Veuillez vous connecter avec vos identifiants.');
        setLoading(false);
        return;
      }

      // ÉTAPE 3 : Upsert du profil avec les vraies données du formulaire
      // (maintenant que la session JWT est active, la politique RLS "auth.uid() = id" passe)
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

      // ÉTAPE 4 : Lire le profil final depuis la BD (source de vérité)
      const { data: savedProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      const finalProfile = savedProfile ?? { ...profileData, created_at: new Date().toISOString() };

      // ÉTAPE 5 : Stocker en mémoire et rediriger
      setUser(finalProfile);
      setSuccessMsg('✅ Compte créé avec succès ! Redirection vers votre espace...');
      setTimeout(() => router.push('/dashboard'), 800);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1a3a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/20 p-8 space-y-6 relative z-10">
        
        {/* Header Logo & Title */}
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

        {/* Mode Switcher Tabs */}
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

        {/* Feedback Messages */}
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

        {/* LOGIN FORM */}
        {mode === 'login' && !resetMode ? (
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

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setResetMode(true); setError(''); setSuccessMsg(''); }}
                className="text-xs text-amber-600 hover:text-amber-700 font-semibold"
              >
                Mot de passe oublié ?
              </button>
            </div>

            <Button type="submit" className="w-full h-11 text-sm font-bold" isLoading={loading}>
              Se connecter à mon espace
            </Button>
          </form>
        ) : mode === 'login' && resetMode ? (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <p className="text-xs text-slate-500">
              Entrez votre adresse email pour recevoir un lien de réinitialisation de mot de passe.
            </p>
            <Input
              label="Adresse Email"
              type="email"
              placeholder="votre.email@exemple.ci"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
            />

            <Button type="submit" variant="secondary" className="w-full h-11 text-sm font-bold" isLoading={resetLoading}>
              Envoyer le lien de réinitialisation
            </Button>

            <button
              type="button"
              onClick={() => { setResetMode(false); setError(''); setSuccessMsg(''); }}
              className="w-full text-xs text-slate-500 hover:text-slate-700 font-semibold"
            >
              Retour à la connexion
            </button>
          </form>
        ) : (
          /* REGISTER FORM */
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
