'use client';

/**
 * Mini App « Paiement en ligne » : mode proposé aux clients (SasPay ou manuel), connexion SasPay,
 * statistiques des paiements en ligne et transactions.
 */
import React, { useState } from 'react';
import { Card } from '@heroui/react';
import { toast } from 'sonner';
import { CheckCircle, Clock, CreditCard, LayoutDashboard, PauseCircle, PlayCircle, Receipt, RefreshCw, Wallet, Webhook, XCircle } from 'lucide-react';
import { StatTile } from '@/components/ui/StatTile';
import { KpiGrid } from '@/components/ui/KpiGrid';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { confirmAction } from '@/components/ui/ConfirmDialog';
import { ChartPanel, MiniAreaChart, MiniBarChart, dayLabel } from '@/components/charts/MiniCharts';
import {
  Empty,
  ErrorCard,
  ExternalLinkButton,
  ListCard,
  Loading,
  MiniAppShell,
  SectionTitle,
  haptic,
  miniApi,
  useMiniAppData,
  type MiniAppTab,
} from '@/components/telegram/MiniAppShell';
import type { PaymentStatus } from '@/lib/telegram-payment';
import { formatAmountShort, formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';

type Tab = 'home' | 'transactions';

interface Overview {
  status: PaymentStatus;
  totals: { total: number; succeeded: number; failed: number; pending: number; amount: number };
  daily: { day: string; succeeded: number; failed: number; pending: number; amount: number }[];
  networks: { network: string; n: number }[];
}

interface Payment {
  id: string;
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
  amount: string;
  network: string | null;
  environment: string | null;
  failure_reason: string | null;
  subscription_id: string | null;
  created_at: string;
  organization_name: string;
  plan_name: string | null;
}

const STATUS: Record<Payment['status'], { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  succeeded: { label: 'Payé', variant: 'success' },
  pending: { label: 'En attente', variant: 'warning' },
  failed: { label: 'Échoué', variant: 'danger' },
  cancelled: { label: 'Annulé', variant: 'neutral' },
  expired: { label: 'Expiré', variant: 'neutral' },
};

async function post(body: Record<string, unknown>) {
  return miniApi<{ message: string }>('paiements', '', { method: 'POST', body: JSON.stringify(body) });
}

// ── Accueil ──────────────────────────────────────────────────────────────────

const loadOverview = () => miniApi<Overview>('paiements', '?view=overview');

function HomeView() {
  const [data, error, reload] = useMiniAppData(loadOverview, 'overview');
  const [busy, setBusy] = useState(false);
  if (error) return <ErrorCard message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const { status, totals } = data;
  const online = status.effective === 'saspay';
  const rate = totals.succeeded + totals.failed > 0 ? Math.round((totals.succeeded / (totals.succeeded + totals.failed)) * 100) : null;
  const daily = data.daily.map((d) => ({ ...d, label: dayLabel(d.day) }));

  const toggle = async () => {
    const next = online ? 'manual' : 'saspay';
    const ok = await confirmAction(
      next === 'manual'
        ? 'Les clients verront de nouveau les moyens de paiement manuels (QR code, numéro).'
        : 'Les clients verront « Passer au paiement » (SasPay, Mobile Money et carte).',
      { title: next === 'manual' ? 'Basculer en paiement manuel' : 'Activer le paiement en ligne', confirmLabel: next === 'manual' ? 'Basculer' : 'Activer', danger: next === 'manual' }
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await post({ action: 'mode', mode: next });
      haptic('success');
      toast.success(res.message);
      await reload();
    } catch (err) {
      haptic('error');
      toast.error(err instanceof Error ? err.message : 'Bascule impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Card.Header className="flex-row items-start justify-between gap-2">
          <div className="min-w-0">
            <Card.Description>Proposé aux clients</Card.Description>
            <Card.Title className="text-lg">{online ? 'Paiement en ligne (SasPay)' : 'Paiement manuel'}</Card.Title>
          </div>
          <Badge variant={online ? 'success' : 'warning'}>{online ? 'En ligne' : 'Manuel'}</Badge>
        </Card.Header>
        <Card.Content className="flex flex-col gap-2 text-sm">
          {status.mode === 'saspay' && !online && <p className="text-warning">SasPay choisi mais indisponible : les clients voient le paiement manuel.</p>}
          <p className="flex items-center gap-2 text-muted">
            {status.connection.ok ? <CheckCircle className="size-4 text-success" aria-hidden /> : <XCircle className="size-4 text-danger" aria-hidden />}
            SasPay{status.environment ? ` (${status.environment === 'LIVE' ? 'réel' : 'test'})` : ''} : {status.connection.label}
          </p>
          <p className="flex items-center gap-2 text-muted">
            <Webhook className="size-4" aria-hidden />
            Dernier webhook :{' '}
            {status.lastWebhook ? `${status.lastWebhook.event_type} · ${formatDateFR(status.lastWebhook.received_at)}${status.lastWebhook.signature_ok ? '' : ' · signature refusée'}` : 'aucun reçu'}
          </p>
          {status.day.to_fix > 0 && <p className="font-medium text-danger">{status.day.to_fix} paiement(s) reçu(s) sans licence activée : à traiter dans Transactions.</p>}
        </Card.Content>
        <Card.Footer>
          {online ? (
            <Button className="w-full" variant="danger-soft" icon={PauseCircle} isLoading={busy} onClick={toggle}>
              Basculer en paiement manuel
            </Button>
          ) : (
            <Button className="w-full" icon={PlayCircle} isLoading={busy} disabled={!status.enabled} onClick={toggle}>
              Activer le paiement en ligne
            </Button>
          )}
        </Card.Footer>
      </Card>

      <SectionTitle action={<ExternalLinkButton path="/platform/payments" />}>30 derniers jours</SectionTitle>
      <KpiGrid cols={{ base: 2 }}>
        <StatTile label="Encaissé en ligne" value={formatCurrencyFCFA(totals.amount)} icon={Wallet} accent="emerald" hint={`${totals.succeeded} paiement${totals.succeeded > 1 ? 's' : ''} réussi${totals.succeeded > 1 ? 's' : ''}`} />
        <StatTile label="Taux de réussite" value={rate === null ? '—' : `${rate} %`} icon={CheckCircle} accent={rate !== null && rate < 70 ? 'amber' : 'indigo'} hint={`${totals.failed} non abouti${totals.failed > 1 ? 's' : ''}`} />
        <StatTile label="En attente" value={totals.pending} icon={Clock} accent={totals.pending ? 'amber' : 'slate'} />
        <StatTile label="Dernières 24 h" value={status.day.ok} icon={CreditCard} accent="slate" hint={`payés · ${status.day.ko} non aboutis`} />
      </KpiGrid>

      <ChartPanel title="Montant encaissé par jour" headline={formatCurrencyFCFA(totals.amount)}>
        <MiniAreaChart data={daily} xKey="label" series={[{ key: 'amount', label: 'Encaissé', color: 's3' }]} format={formatAmountShort} />
      </ChartPanel>

      <ChartPanel
        title="Paiements par jour et par résultat"
        legend={[
          { label: 'Payés', color: 's3', value: totals.succeeded },
          { label: 'Non aboutis', color: 'danger', value: totals.failed },
          { label: 'En attente', color: 's4', value: totals.pending },
        ]}
      >
        <MiniBarChart
          data={daily}
          xKey="label"
          series={[
            { key: 'succeeded', label: 'Payés', color: 's3' },
            { key: 'failed', label: 'Non aboutis', color: 'danger' },
            { key: 'pending', label: 'En attente', color: 's4' },
          ]}
        />
      </ChartPanel>

      {data.networks.length > 0 && (
        <ChartPanel title="Paiements réussis par réseau">
          <MiniBarChart data={data.networks} xKey="network" layout="horizontal" height={Math.max(110, data.networks.length * 36)} series={[{ key: 'n', label: 'Paiements', color: 's1' }]} />
        </ChartPanel>
      )}
    </div>
  );
}

// ── Transactions ─────────────────────────────────────────────────────────────

const loadTransactions = () => miniApi<{ payments: Payment[] }>('paiements', '?view=transactions');

function TransactionsView() {
  const [data, error, reload] = useMiniAppData(loadTransactions, 'transactions');
  const [busy, setBusy] = useState<string | null>(null);
  if (error) return <ErrorCard message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (!data.payments.length) return <Empty icon={Receipt} text="Aucun paiement en ligne pour l’instant." />;

  const sync = async (p: Payment) => {
    setBusy(p.id);
    try {
      const res = await post({ action: 'sync', id: p.id });
      haptic('success');
      toast.success(res.message);
      await reload();
    } catch (err) {
      haptic('error');
      toast.error(err instanceof Error ? err.message : 'Revérification impossible.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle action={<ExternalLinkButton path="/platform/payments" />}>{data.payments.length} derniers paiements</SectionTitle>
      <ListCard>
        {data.payments.map((p) => (
          <div key={p.id} className="flex flex-col gap-2 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{p.organization_name}</p>
                <p className="truncate text-xs text-muted">
                  {formatCurrencyFCFA(Number(p.amount))} · {p.plan_name ?? '—'}
                  {p.network ? ` · ${p.network}` : ''} · {formatDateFR(p.created_at)}
                </p>
              </div>
              <Badge variant={STATUS[p.status]?.variant ?? 'neutral'}>{STATUS[p.status]?.label ?? p.status}</Badge>
            </div>
            {p.failure_reason && p.status !== 'succeeded' && <p className="text-xs text-muted">{p.failure_reason}</p>}
            {p.status === 'succeeded' && !p.subscription_id && <p className="text-xs font-medium text-danger">Payé sans licence activée : à traiter dans le back-office (Transactions).</p>}
            {p.status === 'pending' && (
              <Button size="sm" variant="secondary" icon={RefreshCw} isLoading={busy === p.id} disabled={!!busy} onClick={() => sync(p)}>
                Revérifier auprès de SasPay
              </Button>
            )}
          </div>
        ))}
      </ListCard>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const TABS: MiniAppTab<Tab>[] = [
  { id: 'home', label: 'Accueil', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
];

export default function PaiementsMiniApp() {
  const [tab, setTab] = useState<Tab>('home');
  const [refreshKey, setRefreshKey] = useState(0);
  const view = `${tab}-${refreshKey}`;
  return (
    <MiniAppShell app="paiements" tabs={TABS} tab={tab} onTab={setTab} onRefresh={() => setRefreshKey((k) => k + 1)}>
      {tab === 'home' && <HomeView key={view} />}
      {tab === 'transactions' && <TransactionsView key={view} />}
    </MiniAppShell>
  );
}
