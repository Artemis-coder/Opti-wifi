'use client';

/**
 * Mini App « IA — Claude Code » : demandes de développement confiées à Claude
 * (plan à valider, développement, intégration dans develop, mise en production).
 */
import React, { useCallback, useState } from 'react';
import { Card } from '@heroui/react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle, ClipboardList, GitPullRequest, Hammer, LayoutDashboard, ListTodo, PenLine, Rocket, Send, XCircle } from 'lucide-react';
import { StatTile } from '@/components/ui/StatTile';
import { KpiGrid } from '@/components/ui/KpiGrid';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { confirmAction } from '@/components/ui/ConfirmDialog';
import { ChartPanel, MiniBarChart, MiniDonut, dayLabel, type SeriesColor } from '@/components/charts/MiniCharts';
import {
  Empty,
  ErrorCard,
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
import type { DevRequest as DevRequestRow, DevRequestStatus } from '@/lib/dev-requests';

type DevRequest = DevRequestRow & { pr_url: string | null };
import { formatDateFR } from '@/lib/utils/format';

type Tab = 'home' | 'requests' | 'new' | 'production';

const STATUS: Record<DevRequestStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; color: SeriesColor }> = {
  planning: { label: 'Plan en préparation', variant: 'info', color: 's1' },
  plan_ready: { label: 'Plan à valider', variant: 'warning', color: 's4' },
  developing: { label: 'En développement', variant: 'info', color: 's1' },
  review: { label: 'À valider', variant: 'warning', color: 's4' },
  integrated: { label: 'En préproduction', variant: 'success', color: 's3' },
  in_production: { label: 'En production', variant: 'success', color: 's3' },
  abandoned: { label: 'Abandonnée', variant: 'neutral', color: 's2' },
  failed: { label: 'Bloquée', variant: 'danger', color: 'danger' },
};

function StatusBadge({ status }: { status: DevRequestStatus }) {
  const s = STATUS[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

interface Overview {
  byStatus: { status: DevRequestStatus; n: number }[];
  weekly: { week: string; created: number; delivered: number }[];
  waiting: DevRequest[];
  open: DevRequest[];
  config: { routine: boolean; github: boolean; repoUrl: string };
}

// ── Fiche d'une demande (actions selon le statut) ────────────────────────────

function RequestCard({ r, onChanged }: { r: DevRequest; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const run = async (action: string, confirm?: { message: string; title: string; label: string; danger?: boolean }, extra: Record<string, unknown> = {}) => {
    if (confirm && !(await confirmAction(confirm.message, { title: confirm.title, confirmLabel: confirm.label, danger: confirm.danger }))) return;
    setBusy(action);
    try {
      const res = await miniApi<{ message: string }>('ia', '', { method: 'POST', body: JSON.stringify({ action, id: r.id, ...extra }) });
      haptic('success');
      toast.success(res.message);
      setFeedback('');
      setShowFeedback(false);
      onChanged();
    } catch (err) {
      haptic('error');
      toast.error(err instanceof Error ? err.message : 'Action impossible.');
    } finally {
      setBusy(null);
    }
  };

  const canFeedback = ['plan_ready', 'review', 'failed'].includes(r.status);
  const detail = r.status === 'plan_ready' ? r.plan : r.summary;

  return (
    <Card>
      <Card.Header>
        <div className="flex items-start justify-between gap-2">
          <Card.Title className="text-base">
            #{r.id} · {r.title}
          </Card.Title>
          <StatusBadge status={r.status} />
        </div>
        <Card.Description>Mise à jour le {formatDateFR(r.updated_at)}</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3 text-sm">
        {detail && (
          <details className="rounded-xl bg-default px-3 py-2" open={r.status === 'plan_ready' || r.status === 'review'}>
            <summary className="cursor-pointer text-xs font-medium text-muted">
              {r.status === 'plan_ready' ? 'Plan proposé par Claude' : r.status === 'failed' ? 'Blocage' : 'Récapitulatif'}
            </summary>
            <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap text-foreground">{detail}</p>
          </details>
        )}
        {showFeedback && (
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            placeholder={r.status === 'plan_ready' ? 'Vos remarques sur le plan…' : 'Ce qu’il faut corriger…'}
            aria-label="Remarques pour Claude"
            className="w-full rounded-xl border border-separator bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
        )}
      </Card.Content>
      <Card.Footer className="flex flex-wrap gap-2">
        {r.status === 'plan_ready' && !showFeedback && (
          <Button className="flex-1" icon={CheckCircle} isLoading={busy === 'approve'} disabled={!!busy} onClick={() => run('approve')}>
            Valider le plan
          </Button>
        )}
        {r.status === 'review' && !showFeedback && (
          <>
            {r.pr_url && (
              <Button className="flex-1" variant="secondary" icon={GitPullRequest} onClick={() => openExternal(r.pr_url as string)}>
                PR #{r.pr_number}
              </Button>
            )}
            <Button
              className="flex-1"
              icon={CheckCircle}
              isLoading={busy === 'merge'}
              disabled={!!busy}
              onClick={() => run('merge', { title: 'Intégrer dans develop', message: `Fusionner la PR de la demande #${r.id} dans develop (préproduction) ?`, label: 'Intégrer' })}
            >
              Intégrer
            </Button>
          </>
        )}
        {r.status === 'failed' && !showFeedback && (
          <Button className="flex-1" icon={Hammer} isLoading={busy === 'retry'} disabled={!!busy} onClick={() => run('retry')}>
            Relancer
          </Button>
        )}
        {canFeedback &&
          (showFeedback ? (
            <>
              <Button className="flex-1" icon={Send} isLoading={busy === 'feedback'} disabled={!!busy || feedback.trim().length < 3} onClick={() => run('feedback', undefined, { text: feedback })}>
                Envoyer à Claude
              </Button>
              <Button variant="tertiary" onClick={() => setShowFeedback(false)}>
                Annuler
              </Button>
            </>
          ) : (
            <Button className="flex-1" variant="secondary" icon={PenLine} disabled={!!busy} onClick={() => setShowFeedback(true)}>
              {r.status === 'plan_ready' ? 'Modifier' : r.status === 'failed' ? 'Préciser' : 'Corriger'}
            </Button>
          ))}
        {!['integrated', 'in_production', 'abandoned'].includes(r.status) && !showFeedback && (
          <Button
            variant="danger-soft"
            icon={XCircle}
            isIconOnly
            aria-label="Abandonner"
            disabled={!!busy}
            onClick={() => run('abandon', { title: 'Abandonner la demande', message: `Abandonner la demande #${r.id} ?`, label: 'Abandonner', danger: true })}
          />
        )}
      </Card.Footer>
    </Card>
  );
}

// ── Accueil ──────────────────────────────────────────────────────────────────

const loadOverview = () => miniApi<Overview>('ia', '?view=overview');

function HomeView({ goTo }: { goTo: (t: Tab) => void }) {
  const [data, error, reload] = useMiniAppData(loadOverview, 'overview');
  if (error) return <ErrorCard message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const count = (list: DevRequestStatus[]) => data.byStatus.filter((s) => list.includes(s.status)).reduce((a, s) => a + s.n, 0);
  const weekly = data.weekly.map((w) => ({ ...w, label: dayLabel(w.week) }));
  const donut = (Object.keys(STATUS) as DevRequestStatus[])
    .map((st) => ({ label: STATUS[st].label, value: count([st]), color: STATUS[st].color }))
    .filter((d) => d.value > 0);

  return (
    <div className="flex flex-col gap-4">
      {(!data.config.routine || !data.config.github) && (
        <Card>
          <Card.Content className="flex-row items-start gap-3 text-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            <div className="text-muted">
              {!data.config.routine && <p>Routine Claude non configurée : les demandes sont enregistrées mais Claude n’est pas réveillé.</p>}
              {!data.config.github && <p>Accès GitHub non configuré : pas de fusion de PR depuis Telegram.</p>}
            </div>
          </Card.Content>
        </Card>
      )}

      <KpiGrid cols={{ base: 2 }}>
        <StatTile label="À valider" value={count(['plan_ready', 'review'])} icon={ClipboardList} accent="amber" alert={count(['plan_ready', 'review']) > 0} hint="plans et développements" />
        <StatTile label="En cours" value={count(['planning', 'developing'])} icon={Hammer} accent="indigo" hint="Claude travaille" />
        <StatTile label="Livrées" value={count(['integrated', 'in_production'])} icon={Rocket} accent="emerald" hint={`${count(['in_production'])} en production`} />
        <StatTile label="Bloquées" value={count(['failed'])} icon={AlertTriangle} accent={count(['failed']) ? 'red' : 'slate'} />
      </KpiGrid>

      <ChartPanel title="Demandes par semaine (8 semaines)" legend={[{ label: 'Créées', color: 's1' }, { label: 'Livrées', color: 's3' }]}>
        <MiniBarChart
          data={weekly}
          xKey="label"
          series={[
            { key: 'created', label: 'Créées', color: 's1' },
            { key: 'delivered', label: 'Livrées', color: 's3' },
          ]}
        />
      </ChartPanel>

      <ChartPanel title="Répartition par statut" legend={donut.map((d) => ({ label: d.label, color: d.color, value: d.value }))}>
        <MiniDonut data={donut} />
      </ChartPanel>

      <SectionTitle>Attendent votre validation</SectionTitle>
      {data.waiting.length ? (
        data.waiting.map((r) => <RequestCard key={r.id} r={r} onChanged={reload} />)
      ) : (
        <Empty icon={CheckCircle} text="Rien à valider pour le moment." />
      )}
      <Button variant="secondary" icon={PenLine} onClick={() => goTo('new')}>
        Nouvelle demande à Claude
      </Button>
    </div>
  );
}

// ── Toutes les demandes ──────────────────────────────────────────────────────

function RequestsView() {
  const [scope, setScope] = useState<'open' | 'all'>('open');
  const load = useCallback(() => miniApi<{ requests: DevRequest[] }>('ia', `?view=list&scope=${scope}`), [scope]);
  const [data, error, reload] = useMiniAppData(load, `list-${scope}`);
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {(['open', 'all'] as const).map((s) => (
          <Button key={s} size="sm" variant={scope === s ? 'primary' : 'secondary'} onClick={() => setScope(s)}>
            {s === 'open' ? 'En cours' : 'Historique'}
          </Button>
        ))}
      </div>
      {error ? (
        <ErrorCard message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : !data.requests.length ? (
        <Empty icon={ListTodo} text={scope === 'open' ? 'Aucune demande en cours.' : 'Aucune demande pour l’instant.'} />
      ) : (
        data.requests.map((r) =>
          openId === r.id ? (
            <RequestCard key={r.id} r={r} onChanged={reload} />
          ) : (
            <ListCard key={r.id}>
              <ListRow onPress={() => setOpenId(r.id)} title={`#${r.id} · ${r.title}`} subtitle={formatDateFR(r.updated_at)} end={<StatusBadge status={r.status} />} />
            </ListCard>
          )
        )
      )}
    </div>
  );
}

// ── Nouvelle demande ─────────────────────────────────────────────────────────

function NewRequestView({ done }: { done: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const res = await miniApi<{ message: string }>('ia', '', { method: 'POST', body: JSON.stringify({ action: 'new', text }) });
      haptic('success');
      toast.success(res.message);
      setText('');
      done();
    } catch (err) {
      haptic('error');
      toast.error(err instanceof Error ? err.message : 'Envoi impossible.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <Card.Header>
        <Card.Title>Confier une demande à Claude</Card.Title>
        <Card.Description>
          Décrivez la fonctionnalité ou la correction, à qui elle sert et ce qui compte pour vous. Claude propose un plan à valider ; rien n’est intégré ni mis en production sans
          votre accord.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="Ex. : ajouter un export Excel des collectes par point de vente dans l’espace client…"
          aria-label="Description de la demande"
          className="w-full rounded-xl border border-separator bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
      </Card.Content>
      <Card.Footer>
        <Button className="w-full" icon={Send} isLoading={busy} disabled={text.trim().length < 10} onClick={submit}>
          Envoyer à Claude
        </Button>
      </Card.Footer>
    </Card>
  );
}

// ── Mise en production ───────────────────────────────────────────────────────

const loadProduction = () => miniApi<{ configured: boolean; aheadBy: number; commits: string[] }>('ia', '?view=production');

function ProductionView() {
  const [data, error, reload] = useMiniAppData(loadProduction, 'production');
  const [busy, setBusy] = useState(false);
  if (error) return <ErrorCard message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (!data.configured) return <Empty icon={AlertTriangle} text="Accès GitHub non configuré : la mise en production se fait depuis GitHub." />;

  const ship = async () => {
    const ok = await confirmAction(
      `${data.aheadBy} commit(s) de develop partiront en production (www.optiwifi.site). Vérifiez d’abord la préproduction et la sauvegarde de la base.`,
      { title: 'Mettre en production', confirmLabel: 'Mettre en production', danger: true }
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await miniApi<{ message: string }>('ia', '', { method: 'POST', body: JSON.stringify({ action: 'production' }) });
      haptic('success');
      toast.success(res.message);
      await reload();
    } catch (err) {
      haptic('error');
      toast.error(err instanceof Error ? err.message : 'Mise en production impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <KpiGrid cols={{ base: 2 }}>
        <StatTile label="En attente de production" value={data.aheadBy} icon={Rocket} accent={data.aheadBy ? 'amber' : 'emerald'} hint="commits sur develop" />
        <StatTile label="Préproduction" value="dev" icon={CheckCircle} accent="indigo" hint="dev.optiwifi.site" href="https://dev.optiwifi.site" />
      </KpiGrid>
      {data.aheadBy === 0 ? (
        <Empty icon={CheckCircle} text="La production est à jour : rien à mettre en production." />
      ) : (
        <>
          <SectionTitle>Ce qui partira en production</SectionTitle>
          <ListCard>
            {data.commits.map((c, i) => (
              <ListRow key={`${i}-${c}`} title={c} />
            ))}
          </ListCard>
          <Button variant="secondary" onClick={() => openExternal('https://dev.optiwifi.site')}>
            Ouvrir la préproduction
          </Button>
          <Button icon={Rocket} isLoading={busy} onClick={ship}>
            Mettre en production
          </Button>
        </>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const TABS: MiniAppTab<Tab>[] = [
  { id: 'home', label: 'Accueil', icon: LayoutDashboard },
  { id: 'requests', label: 'Demandes', icon: ListTodo },
  { id: 'new', label: 'Nouvelle', icon: PenLine },
  { id: 'production', label: 'Production', icon: Rocket },
];

export default function IaMiniApp() {
  const [tab, setTab] = useState<Tab>('home');
  const [refreshKey, setRefreshKey] = useState(0);
  const view = `${tab}-${refreshKey}`;
  return (
    <MiniAppShell app="ia" tabs={TABS} tab={tab} onTab={setTab} onRefresh={() => setRefreshKey((k) => k + 1)}>
      {tab === 'home' && <HomeView key={view} goTo={setTab} />}
      {tab === 'requests' && <RequestsView key={view} />}
      {tab === 'new' && <NewRequestView key={view} done={() => setTab('requests')} />}
      {tab === 'production' && <ProductionView key={view} />}
    </MiniAppShell>
  );
}
