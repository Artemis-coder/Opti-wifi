'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Globe,
  Loader2,
  Shield,
  Calendar,
  Bell,
  Mail,
  Key,
  ToggleLeft,
  ToggleRight,
  Wrench,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import { PlatformSettings } from '@/types/platform';

type SettingValue = string | number | boolean;

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState<Record<string, SettingValue>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, SettingValue>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await fetch('/api/platform/settings');
      const result = await res.json();
      if (res.ok && result.data) {
        const settingsMap: Record<string, SettingValue> = {};
        result.data.forEach((s: PlatformSettings) => {
          settingsMap[s.key] = s.value;
        });
        setSettings(settingsMap);
        setEditedValues(settingsMap);
      }
    } catch {
      toast.error('Erreur de chargement des paramètres');
    } finally {
      setLoading(false);
    }
  }

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

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        <span>Chargement des paramètres...</span>
      </div>
    );
  }

  const maintenanceMode = settings.maintenance_mode === true;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Paramètres de la Plateforme</h1>
          <p className="text-xs text-slate-500">Configurez les paramètres globaux de la plateforme SaaS.</p>
        </div>
        <Button onClick={handleSave} variant="secondary" className="gap-2 font-semibold" isLoading={saving}>
          <Save className="w-4 h-4" /> Enregistrer
        </Button>
      </div>

      {/* General */}
      <Card className="space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <Settings className="w-5 h-5 text-amber-500" />
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Général</p>
            <p className="text-xs text-slate-500">Configuration de base de la plateforme.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Nom de la plateforme"
            value={editedValues.platform_name || ''}
            onChange={(e) => updateValue('platform_name', e.target.value)}
            placeholder="OptiWifi"
          />
          <Input
            label="Logo (URL)"
            value={editedValues.platform_logo || ''}
            onChange={(e) => updateValue('platform_logo', e.target.value)}
            placeholder="/assets/logo.jpg"
          />
          <Input
            label="Email support"
            value={editedValues.support_email || ''}
            onChange={(e) => updateValue('support_email', e.target.value)}
            placeholder="support@optiwifi.ci"
          />
          <Input
            label="Téléphone support"
            value={editedValues.support_phone || ''}
            onChange={(e) => updateValue('support_phone', e.target.value)}
            placeholder="+225 XX XX XX XX"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Devise principale
          </label>
          <select
            value={editedValues.platform_currency || 'XOF'}
            onChange={(e) => updateValue('platform_currency', e.target.value)}
            className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
          >
            <option value="XOF">Franc CFA (XOF)</option>
            <option value="XAF">Franc CFA (XAF)</option>
            <option value="EUR">Euro (EUR)</option>
            <option value="USD">Dollar US (USD)</option>
          </select>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-blue-900 dark:text-blue-400" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Autoriser les inscriptions publiques</p>
              <p className="text-xs text-slate-500">Permettre aux nouveaux clients de créer un compte.</p>
            </div>
          </div>
          <button
            onClick={() => updateValue('allow_registration', !editedValues.allow_registration)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              editedValues.allow_registration ? 'bg-amber-500' : 'bg-slate-400'
            }`}
          >
            <span className="sr-only">Toggle registration</span>
            {editedValues.allow_registration ? (
              <ToggleRight className="absolute right-1 h-4 w-4 text-white" />
            ) : (
              <ToggleLeft className="absolute left-1 h-4 w-4 text-white" />
            )}
          </button>
        </div>
      </Card>

      {/* Abonnements */}
      <Card className="space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <Calendar className="w-5 h-5 text-emerald-600" />
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Abonnements</p>
            <p className="text-xs text-slate-500">Période d&apos;essai et période de grâce.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Renouvellement automatique par défaut</p>
              <p className="text-xs text-slate-500">Activer le renouvellement automatique pour les nouveaux abonnés.</p>
            </div>
          </div>
          <button
            onClick={() => updateValue('auto_renew_default', !editedValues.auto_renew_default)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              editedValues.auto_renew_default ? 'bg-amber-500' : 'bg-slate-400'
            }`}
          >
            <span className="sr-only">Toggle auto-renew</span>
            {editedValues.auto_renew_default ? (
              <ToggleRight className="absolute right-1 h-4 w-4 text-white" />
            ) : (
              <ToggleLeft className="absolute left-1 h-4 w-4 text-white" />
            )}
          </button>
        </div>
      </Card>

      {/* Maintenance */}
      <Card className="space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <Wrench className="w-5 h-5 text-red-600" />
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Mode Maintenance</p>
            <p className="text-xs text-slate-500">Activer/désactiver le mode maintenance de la plateforme.</p>
          </div>
        </div>

        <div className={`flex items-center justify-between p-4 rounded-xl border ${
          maintenanceMode
            ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
        }`}>
          <div className="flex items-center gap-3">
            <Wrench className={`w-5 h-5 ${maintenanceMode ? 'text-red-600' : 'text-slate-400'}`} />
            <div>
              <p className={`text-sm font-semibold ${maintenanceMode ? 'text-red-900 dark:text-red-300' : 'text-slate-900 dark:text-white'}`}>
                {maintenanceMode ? 'Maintenance activée' : 'Maintenance désactivée'}
              </p>
              <p className="text-xs text-slate-500">
                {maintenanceMode
                  ? 'La plateforme est temporairement indisponible pour les clients.'
                  : 'La plateforme est opérationnelle pour tous les clients.'}
              </p>
            </div>
          </div>
          <Badge variant={maintenanceMode ? 'danger' : 'neutral'}>
            {maintenanceMode ? 'Actif' : 'Inactif'}
          </Badge>
        </div>

        <Input
          label="Message de maintenance"
          value={editedValues.maintenance_message || ''}
          onChange={(e) => updateValue('maintenance_message', e.target.value)}
          placeholder="La plateforme est actuellement en maintenance..."
        />
      </Card>

      {/* Notifications */}
      <Card className="space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <Mail className="w-5 h-5 text-blue-900 dark:text-blue-400" />
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Notifications Clients</p>
            <p className="text-xs text-slate-500">Configurer les messages envoyés aux clients.</p>
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

      {/* Security */}
      <Card className="space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <Shield className="w-5 h-5 text-emerald-600" />
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Sécurité</p>
            <p className="text-xs text-slate-500">Paramètres de sécurité de la plateforme.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Authentification forte (MFA/2FA)</p>
              <p className="text-xs text-slate-500">Exiger la 2FA pour les super admins.</p>
            </div>
            <Badge variant="success">Activé ✓</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Déconnexion automatique</p>
              <p className="text-xs text-slate-500">Après 30 minutes d&apos;inactivité.</p>
            </div>
            <Badge variant="success">Activé ✓</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Limite des tentatives de connexion</p>
              <p className="text-xs text-slate-500">Blocage après 5 tentatives échouées.</p>
            </div>
            <Badge variant="success">Activé ✓</Badge>
          </div>
        </div>
      </Card>

      {/* Save Button (sticky at bottom) */}
      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} variant="secondary" className="gap-2 font-bold" isLoading={saving}>
          <Save className="w-4 h-4" /> Enregistrer les modifications
        </Button>
      </div>
    </div>
  );
}
