'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Settings, Save, Globe, Loader2, Shield, Calendar, Bell, Mail, Key, Wrench, Bot } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Switch } from '@heroui/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import { PlatformSettings } from '@/types/platform';
import { NotificationChannelsTest } from '@/components/platform/NotificationChannelsTest';
import { BotHealthCard } from '@/components/platform/BotHealthCard';
import { TelegramBotConfigCard } from '@/components/platform/TelegramBotConfigCard';
import { CustomSelect } from '@/components/ui/CustomSelect';

type SettingValue = string | number | boolean;

const SETTINGS_TABS = [
  { value: 'general', label: 'Général', icon: Settings },
  { value: 'notifications', label: 'Notifications', icon: Bell },
  { value: 'bot', label: 'Bot Telegram', icon: Bot },
] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number]['value'];

export default function PlatformSettingsPage() {
  // useSearchParams impose une frontière Suspense pour une page prérendue
  return (
    <Suspense fallback={null}>
      <PlatformSettingsContent />
    </Suspense>
  );
}

function PlatformSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: SettingsTab = SETTINGS_TABS.some((t) => t.value === tabParam) ? (tabParam as SettingsTab) : 'general';
  const selectTab = (value: SettingsTab) =>
    router.replace(value === 'general' ? '/platform/settings' : `/platform/settings?tab=${value}`, { scroll: false });
  const [settings, setSettings] = useState<Record<string, SettingValue>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, SettingValue>>({});

  // Chargé une seule fois à l'ouverture : l'effet lit puis applique (« chargement » = état initial)
  useEffect(() => {
    let cancelled = false;
    fetch('/api/platform/settings')
      .then(async (res) => ({ ok: res.ok, result: await res.json() }))
      .then(({ ok, result }) => {
        if (cancelled || !ok || !result.data) return;
        const settingsMap: Record<string, SettingValue> = {};
        result.data.forEach((s: PlatformSettings) => {
          settingsMap[s.key] = s.value as SettingValue;
        });
        setSettings(settingsMap);
        setEditedValues(settingsMap);
      })
      .catch(() => {
        if (!cancelled) toast.error('Erreur de chargement des paramètres');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    let success = true;
    for (const [key, value] of Object.entries(editedValues)) {
      if (value !== settings[key]) {
        const res = await fetch('/api/platform/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value }),
        });
        if (!res.ok) {
          success = false;
          const result = await res.json();
          toast.error(`Erreur pour "${key}": ${result.error}`);
        }
      }
    }
    if (success) {
      setSettings(editedValues);
      toast.success('Paramètres enregistrés avec succès');
    }
    setSaving(false);
  };

  const updateValue = (key: string, value: SettingValue) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
  };

  const getString = (key: string, fallback = ''): string => {
    const val = editedValues[key];
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    return fallback;
  };

  const getNumber = (key: string, fallback = 0): number => {
    const val = editedValues[key];
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? fallback : parsed;
    }
    return fallback;
  };

  const getBoolean = (key: string, fallback = false): boolean => {
    const val = editedValues[key];
    if (typeof val === 'boolean') return val;
    return fallback;
  };

  if (loading) {
    return (
      <div className="py-10 flex justify-center items-center gap-2 text-muted text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
        <span>Chargement des paramètres...</span>
      </div>
    );
  }

  const maintenanceMode = getBoolean('maintenance_mode');

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Paramètres de la plateforme</h1>
          <p className="text-xs text-muted">Configurez les paramètres globaux de la plateforme SaaS.</p>
        </div>
        {tab !== 'bot' && (
          <Button onClick={handleSave} variant="secondary" className="w-full sm:w-auto" isLoading={saving}>
            <Save className="w-4 h-4" /> Enregistrer
          </Button>
        )}
      </div>

      {/* Onglets : une vue par thème (adresse ?tab=… pour y revenir directement) */}
      <div role="tablist" aria-label="Rubriques des paramètres" className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {SETTINGS_TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(t.value)}
              className={`shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold border transition ${
                active
                  ? 'bg-foreground text-background border-border '
                  : 'bg-surface text-muted border-border hover:border-border'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'general' && (
        <>
          {/* General */}
          <Card className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <Settings className="w-5 h-5 text-warning-soft-foreground" />
              <div>
                <p className="text-sm font-semibold text-foreground">Général</p>
                <p className="text-xs text-muted">Configuration de base de la plateforme.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Input
                label="Nom de la plateforme"
                value={getString('platform_name', 'OptiWifi')}
                onChange={(e) => updateValue('platform_name', e.target.value)}
                placeholder="OptiWifi"
              />
              <Input
                label="Logo (URL)"
                value={getString('platform_logo', '/assets/logo.jpg')}
                onChange={(e) => updateValue('platform_logo', e.target.value)}
                placeholder="/assets/logo.jpg"
              />
              <Input
                label="Email support"
                value={getString('support_email', 'support@optiwifi.ci')}
                onChange={(e) => updateValue('support_email', e.target.value)}
                placeholder="support@optiwifi.ci"
              />
              <Input
                label="Téléphone support"
                value={getString('support_phone')}
                onChange={(e) => updateValue('support_phone', e.target.value)}
                placeholder="+225 XX XX XX XX"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Devise principale
              </label>
              <CustomSelect
                value={getString('platform_currency', 'XOF')}
                onChange={(v) => updateValue('platform_currency', v)}
                options={[
                  { value: 'XOF', label: 'Franc CFA (XOF)' },
                  { value: 'XAF', label: 'Franc CFA (XAF)' },
                  { value: 'EUR', label: 'Euro (EUR)' },
                  { value: 'USD', label: 'Dollar US (USD)' },
                ]}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-surface-secondary rounded-xl">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-accent" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Autoriser les inscriptions publiques</p>
                  <p className="text-xs text-muted">Permettre aux nouveaux clients de créer un compte.</p>
                </div>
              </div>
              <Switch
                aria-label="Autoriser les inscriptions publiques"
                isSelected={!!editedValues.allow_registration}
                onChange={(v) => updateValue('allow_registration', v)}
                className="shrink-0"
            >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>
          </Card>

          {/* Abonnements */}
          <Card className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <Calendar className="w-5 h-5 text-success-soft-foreground" />
              <div>
                <p className="text-sm font-semibold text-foreground">Abonnements</p>
                <p className="text-xs text-muted">Période d&apos;essai et période de grâce.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Input
                label="Jours d'essai gratuit"
                type="number"
                value={editedValues.trial_days?.toString() || '14'}
                onChange={(e) => updateValue('trial_days', parseInt(e.target.value) || 0)}
                placeholder="14"
              />
              <Input
                label="Jours de grâce"
                type="number"
                value={editedValues.grace_period_days?.toString() || '3'}
                onChange={(e) => updateValue('grace_period_days', parseInt(e.target.value) || 0)}
                placeholder="3"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-surface-secondary rounded-xl">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-warning-soft-foreground" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Renouvellement automatique par défaut</p>
                  <p className="text-xs text-muted">Activer le renouvellement automatique pour les nouveaux abonnés.</p>
                </div>
              </div>
              <Switch
                aria-label="Renouvellement automatique par défaut"
                isSelected={!!editedValues.auto_renew_default}
                onChange={(v) => updateValue('auto_renew_default', v)}
                className="shrink-0"
            >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>
          </Card>

          {/* Maintenance */}
          <Card className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <Wrench className="w-5 h-5 text-danger" />
              <div>
                <p className="text-sm font-semibold text-foreground">Mode Maintenance</p>
                <p className="text-xs text-muted">Activer/désactiver le mode maintenance de la plateforme.</p>
              </div>
            </div>

            <div
              className={`flex items-center justify-between p-4 rounded-xl ${
                maintenanceMode
                  ? 'bg-danger-soft '
                  : 'bg-surface-secondary '
              }`}
            >
              <div className="flex items-center gap-3">
                <Wrench className={`w-5 h-5 ${maintenanceMode ? 'text-danger' : 'text-muted'}`} />
                <div>
                  <p
                    className={`text-sm font-semibold ${maintenanceMode ? 'text-danger ' : 'text-foreground '}`}
            >
                    {maintenanceMode ? 'Maintenance activée' : 'Maintenance désactivée'}
                  </p>
                  <p className="text-xs text-muted">
                    {maintenanceMode
                      ? 'La plateforme est temporairement indisponible pour les clients.'
                      : 'La plateforme est opérationnelle pour tous les clients.'}
                  </p>
                </div>
              </div>
              <Badge variant={maintenanceMode ? 'danger' : 'neutral'}>{maintenanceMode ? 'Actif' : 'Inactif'}</Badge>
            </div>

            <Input
              label="Message de maintenance"
              value={getString('maintenance_message', '')}
              onChange={(e) => updateValue('maintenance_message', e.target.value)}
              placeholder="La plateforme est actuellement en maintenance..."
            />
          </Card>

          {/* Security */}
          <Card className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <Shield className="w-5 h-5 text-success-soft-foreground" />
              <div>
                <p className="text-sm font-semibold text-foreground">Sécurité</p>
                <p className="text-xs text-muted">Paramètres de sécurité de la plateforme.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Authentification forte (MFA/2FA)</p>
                  <p className="text-xs text-muted">Exiger la 2FA pour les super admins.</p>
                </div>
                <Badge variant="success">Activé ✓</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Déconnexion automatique</p>
                  <p className="text-xs text-muted">Après 30 minutes d&apos;inactivité.</p>
                </div>
                <Badge variant="success">Activé ✓</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Limite des tentatives de connexion</p>
                  <p className="text-xs text-muted">Blocage après 5 tentatives échouées.</p>
                </div>
                <Badge variant="success">Activé ✓</Badge>
              </div>
            </div>
          </Card>
        </>
      )}

      {tab === 'notifications' && (
        <>
          {/* Notifications */}
          <Card className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <Mail className="w-5 h-5 text-accent" />
              <div>
                <p className="text-sm font-semibold text-foreground">Notifications Clients</p>
                <p className="text-xs text-muted">Configurer les messages envoyés aux clients.</p>
              </div>
            </div>

            <div className="space-y-3">
              <Input
                label="Avant expiration (jours)"
                type="number"
                value={editedValues.notification_before_expiry?.toString() || '7'}
                onChange={(e) => updateValue('notification_before_expiry', parseInt(e.target.value) || 0)}
                helperText="Nombre de jours avant l'expiration pour envoyer un rappel"
              />
              <Input
                label="Jour après expiration"
                type="number"
                value={editedValues.notification_after_expiry?.toString() || '1'}
                onChange={(e) => updateValue('notification_after_expiry', parseInt(e.target.value) || 0)}
                helperText="Jour après expiration pour envoyer un rappel"
              />
            </div>
          </Card>

          <NotificationChannelsTest />
        </>
      )}

      {tab === 'bot' && (
        <>
          <TelegramBotConfigCard />
          <BotHealthCard />
        </>
      )}

      {tab !== 'bot' && (
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} variant="secondary" isLoading={saving}>
            <Save className="w-4 h-4" /> Enregistrer les modifications
          </Button>
        </div>
      )}
    </div>
  );
}
