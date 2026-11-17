'use client';

/**
 * Mini App « Business OptiSpace » : le tableau de bord du super admin dans Telegram.
 * Mêmes chiffres et graphiques que /platform/dashboard (lib/platform-dashboard, lib/platform-stats).
 */
import React, { useCallback, useState } from 'react';
import { Card, Chip } from '@heroui/react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle,
  Clock,
  Inbox,
  KeyRound,
  LayoutDashboard,
  PauseCircle,
  Search,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { StatTile } from '@/components/ui/StatTile';
import { KpiGrid } from '@/components/ui/KpiGrid';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { confirmAction } from '@/components/ui/ConfirmDialog';
import { PlatformStatsSection, type StatsRange } from '@/components/platform/PlatformStats';
import { ChartPanel, MiniAreaChart, MiniBarChart, dayLabel } from '@/components/charts/MiniCharts';
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
  openExternal,
  useMiniAppData,
  type MiniAppTab,
} from '@/components/telegram/MiniAppShell';
import type { DashboardKpiValues, DashboardTodo } from '@/lib/platform-dashboard';
import type { PlatformStats } from '@/lib/platform-stats';
import { formatAmountShort, formatCurrencyFCFA, formatDateOnlyFR } from '@/lib/utils/format';

type Tab = 'home' | 'stats' | 'requests' | 'clients' | 'expiring';

interface LicenseRequest {
  request_id: string;
  type: string;
  duration_months: number;
  message: string | null;
  created_at: string;
  organisation: string;
  contact_name: string | null;
  phone: string | null;
  forfait_demande: string | null;
  prix: string | number | null;
  demande_par: string | null;
  forfait_actuel: string | null;
  fin_licence_actuelle: string | null;
}

interface Organization {
  id: string;
  name: string;
  status: string;
  forfait: string | null;
  fin_licence: string | null;
  utilisateurs: number;
  points_de_vente: number;
}

interface Expiring {
  expirent_bientot: { organisation: string; phone: string | null; forfait: string | null; fin: string; jours_restants: number }[];
  deja_expirees_sans_renouvellement: { organisation: string; phone: string | null; dernier_forfait: string | null; expiree_le: string }[];
}

interface Activity {
  daily: { day: string; amount: number; count: number }[];
  top: { name: string; amount: number }[];
}

const ORG_STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  active: { label: 'Actif', variant: 'success' },
  pending_approval: { label: 'À valider', variant: 'warning' },
  pending: { label: 'En attente', variant: 'warning' },
  trial: { label: 'Essai', variant: 'info' },
  expiring: { label: 'Expire bientôt', variant: 'warning' },
  suspended: { label: 'Suspendu', variant: 'danger' },
  cancelled: { label: 'Refusé', variant: 'neutral' },
  archived: { label: 'Supprimé', variant: 'neutral' },
};

const REQUEST_TYPE: Record<string, string> = { renewal: 'Renouvellement', new: 'Nouvelle licence', upgrade: 'Changement de forfait' };

function OrgStatus({ status }: { status: string }) {
  const s = ORG_STATUS[status] ?? { label: status, variant: 'neutral' as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function whenLabel(days: number): string {
  return days <= 0 ? "aujourd'hui" : days === 1 ? 'demain' : `dans ${days} jours`;
}

// ── Accueil : KPI du tableau de bord ─────────────────────────────────────────

const loadOverview = () => miniApi<{ kpis: DashboardKpiValues; todo: DashboardTodo }>('business', '?view=overview');

function HomeView({ goTo }: { goTo: (t: Tab) => void }) {
  const [data, error, reload] = useMiniAppData(loadOverview, 'overview');
  if (error) return <ErrorCard message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const { kpis, todo } = data;
  const pendingTotal = kpis.pending_registrations + kpis.pending_license_requests + kpis.expiring_7d;

  const todoColumns: {
    title: string;
    icon: React.ElementType;
    count: number;
    empty: string;
    open: () => void;
    items: { key: string; title: string; sub: string; urgent: boolean }[];
  }[] = [
    {
      title: 'Inscriptions à valider',
      icon: UserPlus,
      count: kpis.pending_registrations,
      empty: 'Aucune inscription en attente.',
      open: () => openExternal('/platform/registrations'),
      items: todo.pending_registrations.map((r) => ({ key: r.id, title: r.name, sub: `${r.contact_name ?? '—'} · ${formatDateOnlyFR(r.created_at)}`, urgent: false })),
    },
    {
      title: 'Demandes de licence',
      icon: Inbox,
      count: kpis.pending_license_requests,
      empty: 'Aucune demande en attente.',
      open: () => goTo('requests'),
      items: todo.pending_license_requests.map((r) => ({
        key: r.id,
        title: r.organization_name,
        sub: `${REQUEST_TYPE[r.type] ?? r.type} · ${r.plan_name ?? '—'} · ${r.duration_months} mois`,
        urgent: false,
      })),
    },
    {
      title: 'Licences à renouveler',
      icon: Clock,
      count: kpis.expiring_7d,
      empty: 'Aucune licence n’expire sous 7 jours.',
      open: () => goTo('expiring'),
      items: todo.upcoming_expirations.map((r) => ({
        key: r.id,
        title: r.organization_name,
        sub: `${r.plan_name ?? '—'}${r.is_trial ? ' (essai)' : ''} · expire ${whenLabel(r.days_left)}`,
        urgent: r.days_left <= 2,
      })),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="px-1 text-sm text-muted">
        {pendingTotal > 0 ? `${pendingTotal} élément${pendingTotal > 1 ? 's' : ''} à traiter sur la plateforme.` : 'Rien à traiter pour le moment : tout est à jour.'}
      </p>

      {/* Chiffre d'affaires : paiements de licences réussis (comme « Revenus encaissés ») */}
      <KpiGrid cols={{ base: 2 }}>
        <StatTile
          label="Encaissé ce mois"
          value={formatCurrencyFCFA(kpis.revenue_this_month)}
          icon={Wallet}
          accent="emerald"
          hint={`Licences payées · 7 j : ${formatCurrencyFCFA(kpis.revenue_this_week)}`}
        />
        <StatTile label="Encaissé cette année" value={formatCurrencyFCFA(kpis.revenue_this_year)} icon={BarChart3} accent="indigo" hint={`Aujourd'hui : ${formatCurrencyFCFA(kpis.revenue_today)}`} />
      </KpiGrid>

      {/* Les 6 indicateurs du tableau de bord super admin */}
      <SectionTitle action={<ExternalLinkButton path="/platform/dashboard" />}>Indicateurs clés</SectionTitle>
      <KpiGrid cols={{ base: 2 }}>
        <StatTile label="Clients" value={kpis.total_clients} icon={Building2} accent="indigo" hint={`+${kpis.new_clients_this_month} sur 30 jours`} />
        <StatTile label="Espaces actifs" value={kpis.active_clients} icon={UserCheck} accent="emerald" />
        <StatTile label="Espaces désactivés" value={kpis.suspended_clients} icon={PauseCircle} accent="red" />
        <StatTile label="Licences actives" value={kpis.active_subscriptions} icon={KeyRound} accent="emerald" />
        <StatTile label="Expirent sous 7 j" value={kpis.expiring_7d} icon={Clock} accent="amber" alert={kpis.expiring_7d > 0} />
        <StatTile label="Sans licence active" value={kpis.clients_without_license} icon={AlertTriangle} accent="amber" />
      </KpiGrid>

      <SectionTitle>À traiter</SectionTitle>
      {todoColumns.map((col) => {
        const Icon = col.icon;
        return (
          <Card key={col.title}>
            <Card.Header className="flex-row items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                <Card.Title className="truncate">{col.title}</Card.Title>
              </div>
              <Chip size="sm" variant="soft" color={col.count > 0 ? 'warning' : 'success'}>
                {col.count}
              </Chip>
            </Card.Header>
            <Card.Content className="gap-0">
              {col.items.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">{col.empty}</p>
              ) : (
                <ul className="-mx-2 flex flex-col">
                  {col.items.map((it) => (
                    <li key={it.key}>
                      <button type="button" onClick={col.open} className="block w-full rounded-xl px-2 py-2 text-left transition-colors hover:bg-default">
                        <p className="truncate text-sm font-medium text-foreground">{it.title}</p>
                        <p className={it.urgent ? 'truncate text-xs font-medium text-danger' : 'truncate text-xs text-muted'}>{it.sub}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card.Content>
          </Card>
        );
      })}
    </div>
  );
}

// ── Statistiques : graphiques du tableau de bord + activité des clients ─────

const loadActivity = () => miniApi<Activity>('business', '?view=activity');

function StatsView() {
  const [range, setRange] = useState<StatsRange>('30d');
  const loadStats = useCallback(() => miniApi<PlatformStats>('business', `?view=stats&range=${range}`), [range]);
  const [stats, error, reload] = useMiniAppData(loadStats, `stats-${range}`);
  const [activity] = useMiniAppData(loadActivity, 'activity');

  if (error) return <ErrorCard message={error} onRetry={reload} />;
  const daily = (activity?.daily ?? []).map((d) => ({ ...d, label: dayLabel(d.day) }));
  const total30 = daily.reduce((a, d) => a + d.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      <PlatformStatsSection stats={stats} range={range} onRangeChange={setRange} loading={!stats} />

      <SectionTitle>Activité des clients</SectionTitle>
      <ChartPanel
        title="Collectes des points de vente (30 jours)"
        headline={formatCurrencyFCFA(total30)}
        subtitle="Argent collecté par les clients dans leurs espaces WiFi (ce n'est pas le chiffre d'affaires d'OptiSpace)."
      >
        {activity ? <MiniAreaChart data={daily} xKey="label" series={[{ key: 'amount', label: 'Collecté', color: 's3' }]} format={formatAmountShort} /> : <Loading />}
      </ChartPanel>
      {activity && activity.top.length > 0 && (
        <ChartPanel title="Clients les plus actifs (30 jours)">
          <MiniBarChart
            data={activity.top}
            xKey="name"
            layout="horizontal"
            height={Math.max(120, activity.top.length * 36)}
            series={[{ key: 'amount', label: 'Collecté', color: 's1' }]}
            format={formatAmountShort}
          />
        </ChartPanel>
      )}
    </div>
  );
}

// ── Demandes de licence ──────────────────────────────────────────────────────

const loadRequests = () => miniApi<{ demandes: LicenseRequest[] }>('business', '?view=requests');

function RequestsView() {
  const [data, error, reload] = useMiniAppData(loadRequests, 'requests');
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (r: LicenseRequest, action: 'approve' | 'reject') => {
    const approve = action === 'approve';
    const ok = await confirmAction(
      approve
        ? `Activer le forfait ${r.forfait_demande ?? '—'} pour « ${r.organisation} » pendant ${r.duration_months} mois ?`
        : `Refuser la demande de « ${r.organisation} » ?`,
      { title: approve ? 'Approuver la demande' : 'Refuser la demande', confirmLabel: approve ? 'Approuver' : 'Refuser', danger: !approve }
    );
    if (!ok) return;
    setBusy(r.request_id);
    try {
      const res = await miniApi<{ message: string }>('business', '', { method: 'POST', body: JSON.stringify({ action, requestId: r.request_id }) });
      haptic('success');
      toast.success(res.message);
      await reload();
    } catch (err) {
      haptic('error');
      toast.error(err instanceof Error ? err.message : 'Action impossible.');
    } finally {
      setBusy(null);
    }
  };

  if (error) return <ErrorCard message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const rows = data.demandes;
  if (!rows.length) return <Empty icon={CheckCircle} text="Aucune demande en attente." />;
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle action={<ExternalLinkButton path="/platform/license-requests" />}>
        {rows.length} demande{rows.length > 1 ? 's' : ''} en attente
      </SectionTitle>
      {rows.map((r) => (
        <Card key={r.request_id}>
          <Card.Header>
            <div className="flex items-start justify-between gap-2">
              <Card.Title className="text-base">{r.organisation}</Card.Title>
              <Badge variant="warning">{REQUEST_TYPE[r.type] ?? r.type}</Badge>
            </div>
            <Card.Description>
              {r.forfait_demande ?? 'Forfait non précisé'} · {r.duration_months} mois
              {Number(r.prix) > 0 ? ` · ${formatCurrencyFCFA(Number(r.prix))}` : ''}
            </Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-1 text-sm text-muted">
            {r.contact_name && (
              <p>
                Contact : {r.contact_name}
                {r.phone ? ` · ${r.phone}` : ''}
              </p>
            )}
            <p>
              Licence actuelle :{' '}
              {r.forfait_actuel ? `${r.forfait_actuel}${r.fin_licence_actuelle ? `, jusqu'au ${formatDateOnlyFR(r.fin_licence_actuelle)}` : ''}` : 'aucune'}
            </p>
            <p>
              Demandée le {formatDateOnlyFR(r.created_at)}
              {r.demande_par ? ` par ${r.demande_par}` : ''}
            </p>
            {r.message && <p className="rounded-xl bg-default px-3 py-2 text-foreground">« {r.message} »</p>}
          </Card.Content>
          <Card.Footer className="flex gap-2">
            <Button className="flex-1" icon={CheckCircle} isLoading={busy === r.request_id} disabled={!!busy || !r.forfait_demande} onClick={() => act(r, 'approve')}>
              Approuver
            </Button>
            <Button className="flex-1" variant="danger-soft" icon={XCircle} disabled={!!busy} onClick={() => act(r, 'reject')}>
              Refuser
            </Button>
          </Card.Footer>
        </Card>
      ))}
    </div>
  );
}

// ── Clients ──────────────────────────────────────────────────────────────────

function ClientsView() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const load = useCallback(() => miniApi<{ organisations: Organization[] }>('business', `?view=clients&q=${encodeURIComponent(search)}`), [search]);
  const [data, error, reload] = useMiniAppData(load, `clients-${search}`);

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
        className="flex items-center gap-2 rounded-2xl bg-surface px-4 py-3 shadow-surface"
      >
        <Search className="size-4 text-muted" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => setSearch(q.trim())}
          placeholder="Rechercher un client"
          aria-label="Rechercher un client"
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
      </form>
      {error ? (
        <ErrorCard message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : !data.organisations.length ? (
        <Empty icon={Building2} text="Aucun client trouvé." />
      ) : (
        <ListCard>
          {data.organisations.map((o) => (
            <ListRow
              key={o.id}
              onPress={() => openExternal(`/platform/clients/${o.id}`)}
              title={o.name}
              subtitle={`${o.forfait ? `${o.forfait}${o.fin_licence ? ` · jusqu'au ${formatDateOnlyFR(o.fin_licence)}` : ''}` : 'Sans licence'} · ${o.utilisateurs} util. · ${o.points_de_vente} PDV`}
              end={<OrgStatus status={o.status} />}
            />
          ))}
        </ListCard>
      )}
    </div>
  );
}

// ── Licences à renouveler ────────────────────────────────────────────────────

const loadExpiring = () => miniApi<Expiring>('business', '?view=expiring');

function ExpiringView() {
  const [data, error, reload] = useMiniAppData(loadExpiring, 'expiring');
  if (error) return <ErrorCard message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle action={<ExternalLinkButton path="/platform/subscriptions/expiring" />}>Expirent sous 30 jours</SectionTitle>
      {data.expirent_bientot.length ? (
        <ListCard>
          {data.expirent_bientot.map((r) => (
            <ListRow
              key={`${r.organisation}-${r.fin}`}
              title={r.organisation}
              subtitle={`${r.forfait ?? '—'} · ${formatDateOnlyFR(r.fin)}${r.phone ? ` · ${r.phone}` : ''}`}
              end={<Badge variant={r.jours_restants <= 7 ? 'danger' : 'warning'}>{r.jours_restants <= 0 ? "Aujourd'hui" : `J-${r.jours_restants}`}</Badge>}
            />
          ))}
        </ListCard>
      ) : (
        <Empty icon={CheckCircle} text="Aucune licence n'expire dans les 30 jours." />
      )}

      <SectionTitle>Expirées sans renouvellement</SectionTitle>
      {data.deja_expirees_sans_renouvellement.length ? (
        <ListCard>
          {data.deja_expirees_sans_renouvellement.map((r) => (
            <ListRow
              key={`${r.organisation}-${r.expiree_le}`}
              title={r.organisation}
              subtitle={`${r.dernier_forfait ?? '—'}${r.phone ? ` · ${r.phone}` : ''}`}
              end={<Badge variant="neutral">{formatDateOnlyFR(r.expiree_le)}</Badge>}
            />
          ))}
        </ListCard>
      ) : (
        <Empty icon={CheckCircle} text="Aucun client expiré." />
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const TABS: MiniAppTab<Tab>[] = [
  { id: 'home', label: 'Accueil', icon: LayoutDashboard },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'requests', label: 'Demandes', icon: Inbox },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'expiring', label: 'Licences', icon: CalendarClock },
];

export default function BusinessMiniApp() {
  const [tab, setTab] = useState<Tab>('home');
  const [refreshKey, setRefreshKey] = useState(0);
  const view = `${tab}-${refreshKey}`;

  return (
    <MiniAppShell app="business" tabs={TABS} tab={tab} onTab={setTab} onRefresh={() => setRefreshKey((k) => k + 1)}>
      {tab === 'home' && <HomeView key={view} goTo={setTab} />}
      {tab === 'stats' && <StatsView key={view} />}
      {tab === 'requests' && <RequestsView key={view} />}
      {tab === 'clients' && <ClientsView key={view} />}
      {tab === 'expiring' && <ExpiringView key={view} />}
    </MiniAppShell>
  );
}
