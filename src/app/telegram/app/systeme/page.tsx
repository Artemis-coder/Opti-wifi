'use client';

/**
 * Mini App « Système » : santé de l'application (composants, disponibilité, contrôle en direct)
 * et sécurité (intrusions bloquées, incidents de l'agent de sécurité).
 */
import React, { useState } from 'react';
import { Card } from '@heroui/react';
import { toast } from 'sonner';
import { Activity, AlertTriangle, CheckCircle, EyeOff, Globe2, HeartPulse, ShieldAlert, ShieldCheck, Stethoscope } from 'lucide-react';
import { StatTile } from '@/components/ui/StatTile';
import { KpiGrid } from '@/components/ui/KpiGrid';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { confirmAction } from '@/components/ui/ConfirmDialog';
import { ChartPanel, MiniBarChart, dayLabel } from '@/components/charts/MiniCharts';
import {
  Empty,
  ErrorCard,
  ExternalLinkButton,
  ListCard,
  ListRow,
  Loading,
  MiniAppShell,
  SectionTitle,
  haptic,
  miniApi,
  useMiniAppData,
  type MiniAppTab,
} from '@/components/telegram/MiniAppShell';
import type { HealthSnapshot, SystemHealth, SystemStatus } from '@/lib/system-health';
import { formatDateFR } from '@/lib/utils/format';

type Tab = 'health' | 'security' | 'incidents';

const COMPONENT_LABEL: Record<string, string> = {
  database: 'Base de données',
  api: 'API',
  notifications: 'Notifications',
  server: 'Serveur',
  vercel: 'Déploiements (Vercel)',
  crons: 'Tâches planifiées',
  security: 'Sécurité',
};

const STATUS: Record<SystemStatus, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  ok: { label: 'Opérationnel', variant: 'success' },
  warning: { label: 'À surveiller', variant: 'warning' },
  error: { label: 'En panne', variant: 'danger' },
};

interface Incident {
  id: string;
  title: string;
  severity: 1 | 2 | 3;
  severity_label: string;
  status: string;
  status_label: string;
  source: string;
  account: string | null;
  attempts: number;
  last_seen: string;
  route: string | null;
  analysis: string | null;
  resolution: string | null;
  handled_by: string | null;
}

interface Security {
  day: { events: number; sources: number; open_incidents: number; open_high: number };
  week: { events: number; sources: number };
  byType: { type: string; n: number }[];
  daily: { day: string; low: number; medium: number; high: number }[];
  incidents: Incident[];
  handled: Incident[];
}

// ── Santé ────────────────────────────────────────────────────────────────────

const loadHealth = () => miniApi<{ last: HealthSnapshot | null; daily: { day: string; ok: number; warning: number; error: number }[] }>('systeme', '?view=health');

function HealthView() {
  const [data, error, reload] = useMiniAppData(loadHealth, 'health');
  const [live, setLive] = useState<SystemHealth | null>(null);
  const [checking, setChecking] = useState(false);
  if (error) return <ErrorCard message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const runCheck = async () => {
    setChecking(true);
    try {
      const res = await miniApi<{ health: SystemHealth }>('systeme', '', { method: 'POST', body: JSON.stringify({ action: 'check' }) });
      setLive(res.health);
      haptic(res.health.overall === 'ok' ? 'success' : 'warning');
      await reload();
    } catch (err) {
      haptic('error');
      toast.error(err instanceof Error ? err.message : 'Contrôle impossible.');
    } finally {
      setChecking(false);
    }
  };

  const overall: SystemStatus | null = live?.overall ?? data.last?.overall ?? null;
  const checkedAt = live?.checked_at ?? data.last?.checked_at ?? null;
  const components = live
    ? live.components.map((c) => ({ id: c.id, label: c.label, status: c.status, summary: c.summary, metrics: c.metrics }))
    : (data.last?.components ?? []).map((c) => ({ id: c.id, label: COMPONENT_LABEL[c.id] ?? c.id, status: c.status, summary: c.summary ?? '', metrics: [] as { label: string; value: string }[] }));
  const daily = data.daily.map((d) => ({ ...d, label: dayLabel(d.day) }));
  const totalChecks = data.daily.reduce((a, d) => a + d.ok + d.warning + d.error, 0);
  const okChecks = data.daily.reduce((a, d) => a + d.ok, 0);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Card.Header className="flex-row items-start justify-between gap-2">
          <div className="min-w-0">
            <Card.Description>État général{checkedAt ? ` · ${formatDateFR(checkedAt)}` : ''}</Card.Description>
            <Card.Title className="text-lg">{overall ? STATUS[overall].label : 'Aucun contrôle enregistré'}</Card.Title>
          </div>
          {overall && <Badge variant={STATUS[overall].variant}>{STATUS[overall].label}</Badge>}
        </Card.Header>
        <Card.Footer>
          <Button className="w-full" icon={Stethoscope} isLoading={checking} onClick={runCheck}>
            Lancer un contrôle complet
          </Button>
        </Card.Footer>
      </Card>

      <KpiGrid cols={{ base: 2 }}>
        <StatTile
          label="Disponibilité (7 j)"
          value={totalChecks ? `${Math.round((okChecks / totalChecks) * 100)} %` : '—'}
          icon={HeartPulse}
          accent={totalChecks && okChecks / totalChecks < 0.95 ? 'amber' : 'emerald'}
          hint={`${totalChecks} contrôles`}
        />
        <StatTile
          label="Composants en alerte"
          value={components.filter((c) => c.status !== 'ok').length}
          icon={AlertTriangle}
          accent={components.some((c) => c.status === 'error') ? 'red' : components.some((c) => c.status === 'warning') ? 'amber' : 'slate'}
          hint={`sur ${components.length}`}
        />
      </KpiGrid>

      <ChartPanel
        title="Contrôles de santé par jour (7 jours)"
        legend={[
          { label: 'Opérationnel', color: 's3' },
          { label: 'À surveiller', color: 's4' },
          { label: 'En panne', color: 'danger' },
        ]}
      >
        <MiniBarChart
          data={daily}
          xKey="label"
          series={[
            { key: 'ok', label: 'Opérationnel', color: 's3' },
            { key: 'warning', label: 'À surveiller', color: 's4' },
            { key: 'error', label: 'En panne', color: 'danger' },
          ]}
        />
      </ChartPanel>

      <SectionTitle action={<ExternalLinkButton path="/platform/system" />}>Composants</SectionTitle>
      <ListCard>
        {components.map((c) => (
          <div key={c.id} className="flex flex-col gap-1 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-medium text-foreground">{c.label}</p>
              <Badge variant={STATUS[c.status].variant}>{STATUS[c.status].label}</Badge>
            </div>
            {c.summary && <p className="text-xs text-muted">{c.summary}</p>}
            {c.metrics.length > 0 && (
              <p className="text-xs text-muted">
                {c.metrics
                  .slice(0, 3)
                  .map((m) => `${m.label} : ${m.value}`)
                  .join(' · ')}
              </p>
            )}
          </div>
        ))}
      </ListCard>
      {live && live.recent_errors.length > 0 && (
        <>
          <SectionTitle>Dernières erreurs</SectionTitle>
          <ListCard>
            {live.recent_errors.slice(0, 8).map((e, i) => (
              <ListRow key={`${e.occurred_at}-${i}`} title={e.message} subtitle={`${formatDateFR(e.occurred_at)} · ${e.source}${e.route ? ` · ${e.route}` : ''}`} />
            ))}
          </ListCard>
        </>
      )}
    </div>
  );
}

// ── Sécurité ─────────────────────────────────────────────────────────────────

const loadSecurity = () => miniApi<Security>('systeme', '?view=security');

function SecurityView({ goTo }: { goTo: (t: Tab) => void }) {
  const [data, error, reload] = useMiniAppData(loadSecurity, 'security');
  if (error) return <ErrorCard message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const daily = data.daily.map((d) => ({ ...d, label: dayLabel(d.day) }));
  return (
    <div className="flex flex-col gap-4">
      <KpiGrid cols={{ base: 2 }}>
        <StatTile label="Tentatives (24 h)" value={data.day.events} icon={ShieldAlert} accent={data.day.events ? 'amber' : 'emerald'} hint={`${data.week.events} sur 7 jours`} />
        <StatTile label="Sources (24 h)" value={data.day.sources} icon={Globe2} accent="indigo" hint={`${data.week.sources} sur 7 jours`} />
        <button type="button" className="text-left" onClick={() => goTo('incidents')}>
          <StatTile label="Incidents ouverts" value={data.day.open_incidents} icon={AlertTriangle} accent={data.day.open_incidents ? 'red' : 'slate'} alert={data.day.open_high > 0} hint={`${data.day.open_high} grave${data.day.open_high > 1 ? 's' : ''}`} />
        </button>
        <StatTile label="Incidents traités" value={data.handled.length} icon={ShieldCheck} accent="emerald" hint="derniers" />
      </KpiGrid>

      <ChartPanel
        title="Tentatives bloquées par jour (14 jours)"
        legend={[
          { label: 'Faible', color: 's1' },
          { label: 'Moyenne', color: 's4' },
          { label: 'Élevée', color: 'danger' },
        ]}
      >
        <MiniBarChart
          data={daily}
          xKey="label"
          series={[
            { key: 'low', label: 'Faible', color: 's1' },
            { key: 'medium', label: 'Moyenne', color: 's4' },
            { key: 'high', label: 'Élevée', color: 'danger' },
          ]}
        />
      </ChartPanel>

      {data.byType.length > 0 ? (
        <ChartPanel title="Types de tentatives (7 jours)">
          <MiniBarChart data={data.byType} xKey="type" layout="horizontal" height={Math.max(120, data.byType.length * 36)} series={[{ key: 'n', label: 'Tentatives', color: 's2' }]} />
        </ChartPanel>
      ) : (
        <Empty icon={ShieldCheck} text="Aucune tentative d’intrusion sur 7 jours." />
      )}
    </div>
  );
}

// ── Incidents ────────────────────────────────────────────────────────────────

function IncidentCard({ i, onChanged }: { i: Incident; onChanged?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const decide = async (decision: 'resolve' | 'ignore') => {
    const ok = await confirmAction(decision === 'resolve' ? 'Marquer cet incident comme résolu ?' : 'Classer cet incident comme fausse alerte ?', {
      title: i.title,
      confirmLabel: decision === 'resolve' ? 'Résolu' : 'Fausse alerte',
    });
    if (!ok) return;
    setBusy(decision);
    try {
      const res = await miniApi<{ message: string }>('systeme', '', { method: 'POST', body: JSON.stringify({ action: 'incident', id: i.id, decision }) });
      haptic('success');
      toast.success(res.message);
      onChanged?.();
    } catch (err) {
      haptic('error');
      toast.error(err instanceof Error ? err.message : 'Action impossible.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card>
      <Card.Header>
        <div className="flex items-start justify-between gap-2">
          <Card.Title className="text-base">{i.title}</Card.Title>
          <Badge variant={i.severity === 3 ? 'danger' : i.severity === 2 ? 'warning' : 'neutral'}>{i.severity_label}</Badge>
        </div>
        <Card.Description>
          {i.status_label} · {i.attempts} tentative{i.attempts > 1 ? 's' : ''} · {formatDateFR(i.last_seen)}
        </Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-1 text-sm text-muted">
        <p>Source : {i.source}</p>
        {i.account && <p>Compte visé : {i.account}</p>}
        {/* Route écrite par l'attaquant : affichée telle quelle, comme du texte */}
        {i.route && <p className="truncate font-mono text-xs">{i.route}</p>}
        {i.analysis && (
          <details className="mt-1 rounded-xl bg-default px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium">Analyse de l’agent de sécurité</summary>
            <p className="mt-2 whitespace-pre-wrap text-foreground">{i.analysis}</p>
          </details>
        )}
        {i.resolution && <p className="text-foreground">Résolution : {i.resolution}</p>}
      </Card.Content>
      {onChanged && (
        <Card.Footer className="flex gap-2">
          <Button className="flex-1" icon={CheckCircle} isLoading={busy === 'resolve'} disabled={!!busy} onClick={() => decide('resolve')}>
            Résolu
          </Button>
          <Button className="flex-1" variant="secondary" icon={EyeOff} isLoading={busy === 'ignore'} disabled={!!busy} onClick={() => decide('ignore')}>
            Fausse alerte
          </Button>
        </Card.Footer>
      )}
    </Card>
  );
}

function IncidentsView() {
  const [data, error, reload] = useMiniAppData(loadSecurity, 'incidents');
  const [showHandled, setShowHandled] = useState(false);
  if (error) return <ErrorCard message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const list = showHandled ? data.handled : data.incidents;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button size="sm" variant={!showHandled ? 'primary' : 'secondary'} onClick={() => setShowHandled(false)}>
          À traiter ({data.incidents.length})
        </Button>
        <Button size="sm" variant={showHandled ? 'primary' : 'secondary'} onClick={() => setShowHandled(true)}>
          Traités
        </Button>
      </div>
      {list.length ? (
        list.map((i) => <IncidentCard key={i.id} i={i} onChanged={showHandled ? undefined : reload} />)
      ) : (
        <Empty icon={ShieldCheck} text={showHandled ? 'Aucun incident traité pour l’instant.' : 'Aucun incident à traiter.'} />
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const TABS: MiniAppTab<Tab>[] = [
  { id: 'health', label: 'Santé', icon: Activity },
  { id: 'security', label: 'Sécurité', icon: ShieldCheck },
  { id: 'incidents', label: 'Incidents', icon: ShieldAlert },
];

export default function SystemeMiniApp() {
  const [tab, setTab] = useState<Tab>('health');
  const [refreshKey, setRefreshKey] = useState(0);
  const view = `${tab}-${refreshKey}`;
  return (
    <MiniAppShell app="systeme" tabs={TABS} tab={tab} onTab={setTab} onRefresh={() => setRefreshKey((k) => k + 1)}>
      {tab === 'health' && <HealthView key={view} />}
      {tab === 'security' && <SecurityView key={view} goTo={setTab} />}
      {tab === 'incidents' && <IncidentsView key={view} />}
    </MiniAppShell>
  );
}
