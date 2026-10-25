'use client';

import React, { useState, useEffect } from 'react';
import { User, Lock, Globe, Shield, Save, KeyRound, Loader2, Building2, ShieldCheck } from 'lucide-react';
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

const ORGANIZATION_STATUSES = {
  trial: { label: 'En essai', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400' },
  active: { label: 'Actif', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' },
  expiring: { label: 'Expirant', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400' },
  expired: { label: 'Expiré', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' },
  suspended: { label: 'Suspendu', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400' },
  cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' },
  archived: { label: 'Archivé', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400' },
  pending_approval: { label: 'En attente', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400' },
};

const ORGANIZATION_STATUS_BADGE = {
  trial: 'neutral',
  active: 'success',
  expiring: 'warning',
  expired: 'destructive',
  suspended: 'neutral',
  cancelled: 'destructive',
  archived: 'neutral',
  pending_approval: 'neutral',
};

const ROLE_LABELS = {
  administrateur: 'Administrateur',
  collecteur: 'Collecteur',
};

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [devise, setDevise] = useState<Currency>('XOF');
  const [deviseLocked, setDeviseLocked] = useState(false);

  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!user?.id) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setProfile(data);
        setNom(data.nom || '');
        setTelephone(data.telephone || '');
        const d = (data.devise || 'XOF') as Currency;
        setDevise(d);
        setDeviseLocked(!!data.devise);

        if (data.organization_id) {
          const { data: org } = await supabase.from('organizations').select('*').eq('id', data.organization_id).single();
          if (org) setOrganization(org);
        }
      }
      setLoading(false);
    }
    loadData();
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
      toast.error('Erreur lors de l\'envoi du lien de réinitialisation');
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

      {organization && (
        <Card className="space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <Building2 className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Organisation</p>
              <p className="text-xs text-slate-500">Informations de votre compte organisation.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider text-slate-400 dark:text-slate-500">Nom</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{organization.name || 'Non défini'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider text-slate-400 dark:text-slate-500">Contact</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{organization.contact_name || 'Non défini'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider text-slate-400 dark:text-slate-500">Email</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{organization.email || 'Non défini'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider text-slate-400 dark:text-slate-500">Téléphone</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{organization.phone || 'Non défini'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider text-slate-400 dark:text-slate-500">Adresse</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{organization.address || 'Non défini'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider text-slate-400 dark:text-slate-500">Statut</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                <Badge variant={(ORGANIZATION_STATUS_BADGE as any)[organization.status] || 'neutral'}>
                  {ORGANIZATION_STATUSES[organization.status as keyof typeof ORGANIZATION_STATUSES]?.label || organization.status}
                </Badge>
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider text-slate-400 dark:text-slate-500">Devise</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {CURRENCIES.find((c: { value: Currency; label: string }) => c.value === (organization.currency || 'XOF'))?.label || 'Franc CFA (XOF)'}
              </p>
            </div>
          </div>
        </Card>
      )}

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
                {CURRENCIES.find((c: { value: Currency; label: string }) => c.value === devise)?.label || 'Franc CFA (XOF)'}
              </p>
              <p className="text-xs text-slate-500">Code : {devise}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={deviseLocked ? 'neutral' : 'success'}>
              {deviseLocked ? 'Verrouillée' : 'Fixe'}
            </Badge>
            <p className="text-xs text-slate-500 dark:text-slate-300">
              {deviseLocked ? 'Impossible de changer' : 'Peut être modifié'}
            </p>
          </div>
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

      {profile && (
        <Card className="space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
              <Shield className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Rôle &amp; Activité</p>
              <p className="text-xs text-slate-500">Information sur votre compte et votre rôle.</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                <User className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Rôle</p>
                <p className="text-xs text-slate-500">{ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] || profile.role}</p>
              </div>
            </div>
            <Badge variant={profile.role === 'administrateur' ? 'danger' : 'success'}>
              {ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] || profile.role}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Date de création</p>
              <p className="text-xs text-slate-500 dark:text-slate-300">
                {new Date(profile.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Dernière connexion</p>
              <p className="text-xs text-slate-500 dark:text-slate-300">
                {profile.last_sign_in_at
                  ? new Date(profile.last_sign_in_at).toLocaleDateString('fr-FR')
                  : 'Jamais'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Compte {profile.is_active ? 'Actif' : 'Désactivé'}</p>
              <p className="text-xs text-slate-500">Votre compte est actuellement {profile.is_active ? 'actif' : 'désactivé'}.</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
