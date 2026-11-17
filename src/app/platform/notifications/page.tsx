'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Clock,
  UserPlus,
  Calendar,
  Shield,
  RefreshCw,
  Loader2,
  XCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils/cn';

interface PlatformAlert {
  id: string;
  type: 'expiring' | 'expired' | 'new_client' | 'new_subscription' | 'impersonation' | 'maintenance';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'danger' | 'success';
  link?: string;
  created_at: string;
}

const SEVERITY_CONFIG = {
  info: {
    icon: Bell,
    badge: 'info' as const,
    bg: 'bg-accent-soft',
    iconColor: 'text-accent',
  },
  warning: {
    icon: AlertTriangle,
    badge: 'warning' as const,
    bg: 'bg-warning-soft',
    iconColor: 'text-warning-soft-foreground',
  },
  danger: {
    icon: XCircle,
    badge: 'danger' as const,
    bg: 'bg-danger-soft',
    iconColor: 'text-danger',
  },
  success: {
    icon: CheckCircle,
    badge: 'success' as const,
    bg: 'bg-success-soft',
    iconColor: 'text-success-soft-foreground',
  },
};

const TYPE_ICON = {
  expiring: Clock,
  expired: XCircle,
  new_client: UserPlus,
  new_subscription: Calendar,
  impersonation: Shield,
  maintenance: AlertTriangle,
};

export default function PlatformNotificationsPage() {
  const [alerts, setAlerts] = useState<PlatformAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Calcule les alertes sans toucher à l'état ; l'appelant les applique (effet ou bouton Actualiser)
  const buildAlerts = useCallback(async (): Promise<PlatformAlert[] | null> => {
    try {
      // Fetch data to generate smart alerts
      const [subsRes, orgsRes, logsRes] = await Promise.all([
        fetch('/api/platform/subscriptions'),
        fetch('/api/platform/clients'),
        fetch('/api/platform/audit-logs?limit=20'),
      ]);

      const subsData = subsRes.ok ? await subsRes.json() : { data: [] };
      const orgsData = orgsRes.ok ? await orgsRes.json() : { data: [] };
      const logsData = logsRes.ok ? await logsRes.json() : { data: [] };

      const generated: PlatformAlert[] = [];
      const now = new Date();

      // 1. Subscriptions expiring in 7 days
      const subs: Array<{
        id: string;
        organization_id: string;
        status: string;
        end_date: string | null;
        organization?: { name: string };
      }> = subsData.data || [];
      const expiringSoon = subs.filter((s: { id: string; organization_id: string; status: string; end_date: string | null; organization?: { name: string } }) => {
        if (!s.end_date) return false;
        const end = new Date(s.end_date);
        const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 7 && (s.status === 'active' || s.status === 'trialing');
      });

      if (expiringSoon.length > 0) {
        generated.push({
          id: 'expiring-soon',
          type: 'expiring',
          title: `${expiringSoon.length} abonnement(s) expirent dans 7 jours`,
          message: `Des clients risquent de perdre l'accès à la plateforme. Contactez-les pour renouveler.`,
          severity: 'warning',
          link: '/platform/subscriptions',
          created_at: now.toISOString(),
        });
      }

      // 2. Subscriptions already expired
      const expired = subs.filter((s: { id: string; organization_id: string; status: string; end_date: string | null; organization?: { name: string } }) => s.status === 'expired');
      if (expired.length > 0) {
        generated.push({
          id: 'already-expired',
          type: 'expired',
          title: `${expired.length} abonnement(s) expirés`,
          message: `Ces clients n'ont plus accès à la plateforme. Action requise.`,
          severity: 'danger',
          link: '/platform/subscriptions',
          created_at: now.toISOString(),
        });
      }

      // 3. New clients (last 7 days)
      const orgs: Array<{ id: string; name: string; created_at: string }> = orgsData.data || [];
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const newClients = orgs.filter((o: { id: string; name: string; created_at: string }) => o.created_at >= sevenDaysAgo);
      if (newClients.length > 0) {
        generated.push({
          id: 'new-clients',
          type: 'new_client',
          title: `${newClients.length} nouveau(x) client(s) cette semaine`,
          message: `${newClients.map((o: { id: string; name: string; created_at: string }) => o.name).slice(0, 3).join(', ')}${newClients.length > 3 ? '...' : ''} ont rejoint la plateforme.`,
          severity: 'success',
          link: '/platform/clients',
          created_at: now.toISOString(),
        });
      }

      // 4. Impersonation events in the last 24h (from audit logs)
      const logs: Array<{ id: string; action: string; created_at: string; ip_address?: string }> = logsData.data || [];
      const impersonations = logs.filter((l: { id: string; action: string; created_at: string; ip_address?: string }) => l.action === 'client.impersonate');
      if (impersonations.length > 0) {
        generated.push({
          id: 'impersonation-recent',
          type: 'impersonation',
          title: `${impersonations.length} session(s) d'impersonation récente(s)`,
          message: `Des sessions d'accès client ont été ouvertes par un administrateur. Vérifiez le journal d'audit.`,
          severity: 'info',
          link: '/platform/audit-logs',
          created_at: now.toISOString(),
        });
      }

      // If nothing, add a "all clear" message
      if (generated.length === 0) {
        generated.push({
          id: 'all-clear',
          type: 'maintenance',
          title: 'Tout est en ordre',
          message: 'Aucune alerte active sur la plateforme. Tous les abonnements sont à jour.',
          severity: 'success',
          created_at: now.toISOString(),
        });
      }

      return generated;
    } catch (err) {
      console.warn('Notifications fetch error:', err);
      return null;
    }
  }, []);

  const applyAlerts = (generated: PlatformAlert[] | null) => {
    if (generated) setAlerts(generated);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    buildAlerts().then((generated) => {
      if (!cancelled) applyAlerts(generated);
    });
    return () => {
      cancelled = true;
    };
  }, [buildAlerts]);

  const visibleAlerts = alerts.filter((a: PlatformAlert) => !dismissed.has(a.id));
  const dismissAlert = (id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notifications</h1>
          <p className="text-xs text-muted mt-0.5">
            Alertes système générées automatiquement pour le Super Admin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {visibleAlerts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDismissed(new Set(alerts.map((a: PlatformAlert) => a.id)))}
            >
              Tout marquer comme lu
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              buildAlerts().then(applyAlerts);
            }}
            isLoading={loading}
            >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {loading ? (
        <div className="py-10 flex justify-center items-center gap-2 text-muted text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
          <span>Analyse des alertes en cours...</span>
        </div>
      ) : visibleAlerts.length === 0 ? (
        <Card className="text-center space-y-3 py-8">
          <Bell className="w-12 h-12 text-muted mx-auto" />
          <h3 className="text-base font-semibold text-foreground">
            Aucune notification active
          </h3>
          <p className="text-xs text-muted">
            Toutes les alertes ont été lues. La plateforme fonctionne normalement.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleAlerts.map((alert: PlatformAlert) => {
            const cfg = SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG];
            const TypeIcon = TYPE_ICON[alert.type as keyof typeof TYPE_ICON] || Bell;
            const SevIcon = cfg.icon;

            return (
              <Card
                key={alert.id}
                className={cn(
                  'border-l-4 flex items-start gap-4 transition-all duration-200',
                  cfg.bg
                )}
            >
                <div className={cn('p-2 rounded-xl bg-white/60 shrink-0', cfg.iconColor)}>
                  <TypeIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                        <Badge variant={cfg.badge} className="text-xs">
                          <SevIcon className="w-3 h-3 mr-1" />
                          {alert.severity === 'danger' ? 'Urgent' :
                           alert.severity === 'warning' ? 'Attention' :
                           alert.severity === 'success' ? 'Info' : 'Info'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted mt-1">{alert.message}</p>
                      <p className="text-xs text-muted mt-2">
                        {new Date(alert.created_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <button
                      onClick={() => dismissAlert(alert.id)}
                      className="shrink-0 p-1 rounded-xl text-muted hover:text-muted hover:bg-white/50 transition"
                      aria-label="Ignorer la notification"
            >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                  {alert.link && (
                    <a
                      href={alert.link}
                      className="inline-block mt-3 text-xs font-semibold text-accent hover:underline"
            >
                      Voir les détails →
                    </a>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
