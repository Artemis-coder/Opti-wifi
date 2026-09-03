'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PlatformUser } from '@/types/platform';
import { usePlatformAuthStore } from '@/lib/stores/platformAuthStore';
import { Shield } from 'lucide-react';

export default function PlatformLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();
  const { setPlatformUser } = usePlatformAuthStore();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message || 'Identifiants incorrects.');
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: platformUser, error: puError } = await supabase
        .from('platform_users')
        .select('*')
        .eq('auth_user_id', data.user.id)
        .eq('is_active', true)
        .single();

      if (puError || !platformUser) {
        setError('Accès refusé: vous n\'êtes pas autorisé(e) sur le back-office platforme.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      setPlatformUser(platformUser as unknown as PlatformUser);
      router.push('/platform/dashboard');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0b1a3a] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/20 p-8 space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl mx-auto overflow-hidden relative shadow-lg border border-amber-500/30 flex items-center justify-center bg-[#0b1a3a]">
            <Image src="/assets/logo.jpg" alt="OptiWifi Logo" width={64} height={64} className="object-cover" />
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Opti<span className="text-amber-500">Wifi</span>
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Back-Office Super Administrateur
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="Adresse Email"
            type="email"
            placeholder="superadmin@optiwifi.ci"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
          <Input
            label="Mot de Passe"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <Button type="submit" className="w-full h-11 text-sm font-bold" isLoading={loading}>
            Accéder au Back-Office
          </Button>
        </form>
      </div>
    </div>
  );
}
