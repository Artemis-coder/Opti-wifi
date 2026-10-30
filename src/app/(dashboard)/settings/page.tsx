'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Bell,
  BellRing,
  Building2,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Save,
  Shield,
  ShieldCheck,
  Smartphone,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores/authStore';
import { getPushState, subscribeToPush, type PushState } from '@/lib/push-client';
import { cn } from '@/lib/utils/cn';
import { Profile } from '@/types/database';

const CURRENCY_LABELS: Record<string, string> = {
  XOF: 'Franc CFA (XOF)',
  XAF: 'Franc CFA (XAF)',
  EUR: 'Euro (EUR)',
  USD: 'Dollar US (USD)',
  GHS: 'Cedi ghanéen (GHS)',
  NGN: 'Naira nigérian (NGN)',
};

const ORGANIZATION_STATUSES: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  trial: { label: 'En essai', variant: 'info' },
  active: { label: 'Actif', variant: 'success' },
  expiring: { label: 'Expire bientôt', variant: 'warning' },
  expired: { label: 'Expiré', variant: 'danger' },
  suspended: { label: 'Suspendu', variant: 'neutral' },
  cancelled: { label: 'Annulé', variant: 'danger' },
  archived: { label: 'Archivé', variant: 'neutral' },
  pending_approval: { label: 'En attente', variant: 'info' },
};

const ROLE_LABELS: Record<string, string> = { administrateur: 'Administrateur', collecteur: 'Collecteur' };

const TABS = [
  { value: 'profile', label: 'Profil', icon: User },
  { value: 'organization', label: 'Organisation', icon: Building2 },
  { value: 'security', label: 'Sécurité', icon: Lock },
  { value: 'notifications', label: 'Notifications', icon: Bell },
] as const;
type Tab = (typeof TABS)[number]['value'];

interface Organization {
  name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  status?: string | null;
  currency?: string | null;
}

/** Bloc titre d'une carte de paramètres (même présentation que le back-office). */
function SectionTitle({
  icon: Icon,
  title,
  hint,
  tone = 'text-amber-500',
}: {
  icon: React.ElementType;
  title: string;
  hint: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
      <Icon className={cn('w-5 h-5 shrink-0', tone)} />
      <div>
        <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="text-sm font-medium text-slate-900 dark:text-white break-words">{value || 'Non renseigné'}</div>
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Input
      label={label}
      type={show ? 'text' : 'password'}
      autoComplete={autoComplete}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required
      rightElement={
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-700"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      }
    />
  );
}

const PUSH_LABELS: Record<PushState, string> = {
  subscribed: 'Activées sur cet appareil',
  default: 'Pas encore activées sur cet appareil',
  denied: 'Bloquées dans les réglages du navigateur',
  'ios-needs-install': "Sur iPhone : ajoutez d'abord le site à l'écran d'accueil",
  unsupported: 'Non prises en charge par ce navigateur',
};

export default function SettingsPage() {
  // useSearchParams impose une frontière Suspense pour une page prérendue
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: Tab = TABS.some((t) => t.value === tabParam) ? (tabParam as Tab) : 'profile';
  const selectTab = (value: Tab) => router.replace(value === 'profile' ? '/settings' : `/settings?tab=${value}`, { scroll: false });

  const { user, setUser } = useAuthStore();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [pushState, setPushState] = useState<PushState>('unsupported');
  const [enablingPush, setEnablingPush] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      if (!user?.id) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (cancelled) return;
      if (data) {
        setProfile(data);
        setNom(data.nom || '');
        setTelephone(data.telephone || '');
        if (data.organization_id) {
          const { data: org } = await supabase.from('organizations').select('*').eq('id', data.organization_id).single();
          if (!cancelled && org) setOrganization(org);
        }
      }
      if (!cancelled) setLoading(false);
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, [user?.id, supabase]);

  useEffect(() => {
    getPushState()
      .then(setPushState)
      .catch(() => setPushState('unsupported'));
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ nom, telephone, updated_at: new Date().toISOString() }).eq('id', user?.id);
    if (error) {
      toast.error('Erreur lors de la mise à jour du profil');
    } else {
      toast.success('Profil mis à jour');
      if (user) setUser({ ...user, nom, telephone });
    }
    setSaving(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Les deux nouveaux mots de passe ne correspondent pas.');
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error);
      toast.success('Mot de passe modifié');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Échec du changement de mot de passe');
    } finally {
      setChangingPassword(false);
    }
  };

  const enablePush = async () => {
    setEnablingPush(true);
    try {
      setPushState(await subscribeToPush());
    } finally {
      setEnablingPush(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        Chargement des paramètres…
      </div>
    );
  }

  const orgStatus = organization?.status ? ORGANIZATION_STATUSES[organization.status] : null;
  const currency = organization?.currency || profile?.devise || 'XOF';

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Paramètres</h1>
        <p className="text-xs text-slate-500">Votre profil, votre organisation, la sécurité de votre compte et vos notifications.</p>
      </div>

      {/* Onglets : une vue par thème (adresse ?tab=… pour y revenir directement) */}
      <div role="tablist" aria-label="Rubriques des paramètres" className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(t.value)}
              className={cn(
                'shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-semibold border transition',
                active
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300',
              )}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'profile' && (
        <>
          <Card className="space-y-6">
            <SectionTitle icon={User} title="Informations du compte" hint="Mettez à jour vos données personnelles." />
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <Input label="Nom complet" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Votre nom" required />
              <Input
                label="E-mail"
                type="email"
                value={profile?.email || ''}
                disabled
                helperText="L'adresse de connexion ne peut pas être modifiée ici."
              />
              <Input
                label="Téléphone"
                inputMode="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="+225 07 00 00 00 00"
              />
              <div className="flex justify-end">
                <Button type="submit" icon={Save} variant="secondary" className="w-full sm:w-auto font-bold" isLoading={saving}>
                  Enregistrer
                </Button>
              </div>
            </form>
          </Card>

          {profile && (
            <Card className="space-y-6">
              <SectionTitle
                icon={Shield}
                title="Rôle et activité"
                hint="Votre rôle dans l'organisation et l'état du compte."
                tone="text-slate-500"
              />
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Rôle"
                  value={
                    <Badge variant={profile.role === 'administrateur' ? 'info' : 'success'}>
                      {ROLE_LABELS[profile.role] || profile.role}
                    </Badge>
                  }
                />
                <Field
                  label="Compte"
                  value={<Badge variant={profile.is_active ? 'success' : 'danger'}>{profile.is_active ? 'Actif' : 'Désactivé'}</Badge>}
                />
                <Field
                  label="Créé le"
                  value={new Date(profile.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
                />
                <Field
                  label="Dernière connexion"
                  value={profile.last_sign_in_at ? new Date(profile.last_sign_in_at).toLocaleDateString('fr-FR') : 'Jamais'}
                />
              </div>
            </Card>
          )}
        </>
      )}

      {tab === 'organization' && (
        <Card className="space-y-6">
          <SectionTitle icon={Building2} title="Organisation" hint="Informations de votre compte organisation." />
          {organization ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nom" value={organization.name} />
                <Field
                  label="Statut"
                  value={orgStatus ? <Badge variant={orgStatus.variant}>{orgStatus.label}</Badge> : organization.status}
                />
                <Field label="Contact" value={organization.contact_name} />
                <Field label="E-mail" value={organization.email} />
                <Field label="Téléphone" value={organization.phone} />
                <Field label="Adresse" value={organization.address} />
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
                <span className="w-9 h-9 shrink-0 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Globe className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{CURRENCY_LABELS[currency] || currency}</p>
                  <p className="text-xs text-slate-500">Devise du compte, fixée à la création : elle ne peut pas être modifiée.</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Pour modifier ces informations,{' '}
                <Link href="/support" className="font-semibold text-brand-700 dark:text-brand-300 hover:underline">
                  contactez le support
                </Link>
                .
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">Aucune organisation associée à ce compte.</p>
          )}
        </Card>
      )}

      {tab === 'security' && (
        <>
          <Card className="space-y-6">
            <SectionTitle
              icon={KeyRound}
              title="Changer mon mot de passe"
              hint="Le mot de passe actuel est demandé pour confirmer que c'est bien vous."
              tone="text-indigo-900 dark:text-indigo-300"
            />
            <form onSubmit={handleChangePassword} className="space-y-4">
              <PasswordInput
                label="Mot de passe actuel"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
              />
              <PasswordInput label="Nouveau mot de passe" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
              <PasswordInput
                label="Confirmer le nouveau mot de passe"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
              />
              <p className="text-xs text-slate-500">8 caractères minimum.</p>
              <div className="flex justify-end">
                <Button type="submit" icon={Save} variant="secondary" className="w-full sm:w-auto font-bold" isLoading={changingPassword}>
                  Changer le mot de passe
                </Button>
              </div>
            </form>
          </Card>

          <Card className="space-y-6">
            <SectionTitle
              icon={ShieldCheck}
              title="Protection des données"
              hint="Vos données ne sont visibles que par votre organisation."
              tone="text-emerald-600"
            />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Isolation par organisation</p>
                <p className="text-xs text-slate-500">
                  Chaque organisation ne voit que ses propres données ; les collecteurs n&apos;accèdent qu&apos;à ce qui les concerne.
                </p>
              </div>
              <Badge variant="success">Activée</Badge>
            </div>
          </Card>
        </>
      )}

      {tab === 'notifications' && (
        <Card className="space-y-6">
          <SectionTitle
            icon={BellRing}
            title="Notifications sur cet appareil"
            hint="Recevez les alertes (encaissements, licence, support) même quand le site est fermé."
          />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 shrink-0 rounded-lg bg-brand-500/10 text-brand-600 flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Notifications push</p>
                <p className="text-xs text-slate-500">{PUSH_LABELS[pushState]}</p>
              </div>
            </div>
            {pushState === 'subscribed' ? (
              <Badge variant="success">Activées</Badge>
            ) : pushState === 'default' ? (
              <Button icon={BellRing} onClick={enablePush} isLoading={enablingPush} className="w-full sm:w-auto font-semibold">
                Activer
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-slate-500">
            Les notifications restent aussi disponibles dans la cloche, en haut de l&apos;écran. Le réglage s&apos;applique à cet appareil :
            activez-le sur chaque téléphone ou ordinateur utilisé.
          </p>
        </Card>
      )}
    </div>
  );
}
