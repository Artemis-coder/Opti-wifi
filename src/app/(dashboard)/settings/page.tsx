'use client';

import React, { useState, useEffect } from 'react';
import { User, Lock, Globe, Shield, Save, KeyRound, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores/authStore';
import { Profile } from '@/types/database';

type Currency = 'XOF' | 'EUR' | 'USD' | 'GHS' | 'NGN' | 'XAF';

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: 'XOF', label: 'Franc CFA (XOF)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'Dollar US (USD)' },
  { value: 'GHS', label: 'Cedi Ghanéen (GHS)' },
  { value: 'NGN', label: 'Naira Nigérian (NGN)' },
  { value: 'XAF', label: 'Franc CFA (XAF)' },
];

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [devise, setDevise] = useState<Currency>('XOF');
  const [deviseLocked, setDeviseLocked] = useState(false);

  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setProfile(data);
        setNom(data.nom || '');
        setTelephone(data.telephone || '');
        const d = (data.devise || 'XOF') as Currency;
        setDevise(d);
        setDeviseLocked(!!data.devise);
      }
      setLoading(false);
    }
    loadProfile();
  }, [user?.id, supabase]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ nom, telephone, updated_at: new Date().toISOString() })
      .eq('id', user?.id);

    if (error) {
      toast.error('Erreur lors de la mise à jour du profil');
    } else {
      toast.success('Profil mis à jour avec succès');
      if (user) setUser({ ...user, nom, telephone });
    }
    setSaving(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) {
      toast.error('Erreur lors de l&apos;envoi du lien de réinitialisation');
    } else {
      toast.success('Lien de réinitialisation envoyé par email');
      setResetEmail('');
    }
    setResetLoading(false);
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        Chargement des paramètres...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Paramètres</h1>
        <p className="text-xs text-slate-500">Gérez votre profil et les préférences système.</p>
      </div>

      <Card className="space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <User className="w-5 h-5 text-amber-500" />
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Informations du Compte</p>
            <p className="text-xs text-slate-500">Mettez à jour vos données personnelles.</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Input
            label="Nom complet"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Votre nom"
            required
          />
          <Input
            label="Email"
            type="email"
            value={profile?.email || ''}
            disabled
            className="bg-slate-100 dark:bg-slate-800"
          />
          <Input
            label="Téléphone"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder="+221 77 000 00 00"
          />
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" className="gap-2 font-bold" isLoading={saving}>
              <Save className="w-4 h-4" /> Enregistrer les modifications
            </Button>
          </div>
        </form>
      </Card>

      <Card className="space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <Lock className="w-5 h-5 text-blue-900 dark:text-blue-400" />
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Sécurité</p>
            <p className="text-xs text-slate-500">Réinitialisez votre mot de passe en cas d&apos;oubli.</p>
          </div>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <Input
            label="Email de réinitialisation"
            type="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder="votre@email.com"
            required
          />
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" className="gap-2 font-bold" isLoading={resetLoading}>
              <KeyRound className="w-4 h-4" /> Envoyer le lien de réinitialisation
            </Button>
          </div>
        </form>
      </Card>

      <Card className="space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <Globe className="w-5 h-5 text-amber-500" />
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Devise Principale</p>
            <p className="text-xs text-slate-500">Définie lors de la création du compte. Une fois choisie, elle ne peut plus être modifiée.</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {CURRENCIES.find((c) => c.value === devise)?.label || 'Franc CFA (XOF)'}
              </p>
              <p className="text-xs text-slate-500">Code : {devise}</p>
            </div>
          </div>
          <Badge variant={deviseLocked ? 'neutral' : 'success'}>
            {deviseLocked ? 'Verrouillée' : 'Fixe'}
          </Badge>
        </div>
      </Card>

      <Card className="space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <Shield className="w-5 h-5 text-emerald-600" />
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Sécurité des Données</p>
            <p className="text-xs text-slate-500">Isolation stricte des données par rôle via Row Level Security.</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Protection RLS</p>
            <p className="text-xs text-slate-500">Chaque utilisateur ne voit que ses propres données. Les admins ont un accès complet.</p>
          </div>
          <Badge variant="success">Activé ✓</Badge>
        </div>
      </Card>
    </div>
  );
}
