'use client';

/**
 * Mini App Telegram : le back-office du super admin dans Telegram, avec le design system du projet
 * (HeroUI, StatTile, Badge, Button). Ouverte depuis le bouton « Ouvrir OptiSpace » du bot.
 * Chaque appel API envoie la signature Telegram (initData), vérifiée côté serveur.
 */
import React, { useCallback, useEffect, useState } from 'react';
import Script from 'next/script';
import { Card, Spinner } from '@heroui/react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle,
  ExternalLink,
  Inbox,
  LayoutDashboard,
  RefreshCw,
  Search,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { StatTile } from '@/components/ui/StatTile';
import { KpiGrid } from '@/components/ui/KpiGrid';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { confirmAction } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils/cn';
import { formatCurrencyFCFA, formatDateOnlyFR } from '@/lib/utils/format';

// ── Telegram WebApp ──────────────────────────────────────────────────────────

interface TelegramWebApp {
  initData: string;
  colorScheme: 'light' | 'dark';
  ready: () => void;
  expand: () => void;
  openLink: (url: string) => void;
  onEvent: (event: 'themeChanged', cb: () => void) => void;
  HapticFeedback?: { notificationOccurred: (type: 'success' | 'error' | 'warning') => void };
}

function telegram(): TelegramWebApp | null {
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp ?? null;
}

/** Applique le thème clair/sombre de Telegram aux variables HeroUI. */
function applyTheme(tg: TelegramWebApp) {
  const dark = tg.colorScheme === 'dark';
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.classList.toggle('dark', dark);
  root.classList.toggle('light', !dark);
}

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/telegram/miniapp${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': telegram()?.initData || '', ...init?.headers },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Erreur inattendue.', res.status);
  return data as T;
}

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.optiwifi.site').replace(/\/$/, '');
function openBackOffice(path: string) {
  const url = `${SITE}${path}`;
  const tg = telegram();
  if (tg) tg.openLink(url);
  else window.open(url, '_blank', 'noopener');
}

// ── Données ──────────────────────────────────────────────────────────────────

type Tab = 'home' | 'requests' | 'clients' | 'expiring';

interface Overview {
  overview: {
    organisations_par_statut: { status: string; n: number }[];
    licences: { organisations_avec_licence_active: number; expirent_sous_7_jours: number; expirent_sous_30_jours: number };
    encaissements: { encaisse_ce_mois: number; encaisse_mois_dernier: number; collectes_ce_mois: number };
    activite: { utilisateurs_actifs: number; points_de_vente: number; espaces_wifi: number; connectes_7_derniers_jours: number };
    dernieres_inscriptions: { name: string; status: string; created_at: string }[];
  };
  pendingRequests: number;
  expiring: number;
}

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
  devise: string | null;
  demande_par: string | null;
  forfait_actuel: string | null;
  fin_licence_actuelle: string | null;
}

interface Organization {
  id: string;
  name: string;
  status: string;
  contact_name: string | null;
  forfait: string | null;
  fin_licence: string | null;
  licence_active: boolean | null;
  utilisateurs: number;
  points_de_vente: number;
  derniere_collecte: string | null;
}

interface Expiring {
  expirent_bientot: { organisation: string; contact_name: string | null; phone: string | null; forfait: string | null; fin: string; jours_restants: number }[];
  deja_expirees_sans_renouvellement: { organisation: string; contact_name: string | null; phone: string | null; dernier_forfait: string | null; expiree_le: string }[];
}

const ORG_STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  active: { label: 'Actif', variant: 'success' },
  pending: { label: 'En attente', variant: 'warning' },
  trial: { label: 'Essai', variant: 'info' },
  suspended: { label: 'Suspendu', variant: 'danger' },
  cancelled: { label: 'Refusé', variant: 'neutral' },
  archived: { label: 'Supprimé', variant: 'neutral' },
};

const REQUEST_TYPE: Record<string, string> = { renewal: 'Renouvellement', new: 'Nouvelle licence', upgrade: 'Changement de forfait' };

function OrgStatus({ status }: { status: string }) {
  const s = ORG_STATUS[status] ?? { label: status, variant: 'neutral' as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

// ── Écrans ───────────────────────────────────────────────────────────────────

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <h2 className="text-sm font-semibold text-foreground">{children}</h2>
      {action}
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <Card>
      <Card.Content className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted">
        <Icon className="size-8 opacity-60" aria-hidden />
        {text}
      </Card.Content>
    </Card>
  );
}

function BackOfficeLink({ path, label = 'Back-office' }: { path: string; label?: string }) {
  return (
    <button type="button" onClick={() => openBackOffice(path)} className="flex items-center gap-1 text-xs font-medium text-accent">
      {label}
      <ExternalLink className="size-3.5" aria-hidden />
    </button>
  );
}

function HomeView({ data, goTo }: { data: Overview; goTo: (t: Tab) => void }) {
  const o = data.overview;
  const orgs = Object.fromEntries(o.organisations_par_statut.map((r) => [r.status, r.n]));
  const month = Number(o.encaissements.encaisse_ce_mois) || 0;
  const last = Number(o.encaissements.encaisse_mois_dernier) || 0;
  return (
    <div className="flex flex-col gap-4">
      <KpiGrid cols={{ base: 2 }}>
        <StatTile label="Encaissé ce mois" value={formatCurrencyFCFA(month)} icon={Wallet} accent="emerald" hint={`Mois dernier : ${formatCurrencyFCFA(last)}`} />
        <StatTile label="Clients actifs" value={orgs.active ?? 0} icon={Building2} accent="indigo" hint={`${o.licences.organisations_avec_licence_active} avec licence active`} />
        <button type="button" className="text-left" onClick={() => goTo('requests')}>
          <StatTile label="Demandes" value={data.pendingRequests} icon={Inbox} accent={data.pendingRequests ? 'amber' : 'slate'} alert={data.pendingRequests > 0} hint="en attente de validation" />
        </button>
        <button type="button" className="text-left" onClick={() => goTo('expiring')}>
          <StatTile label="À renouveler" value={data.expiring} icon={CalendarClock} accent={o.licences.expirent_sous_7_jours ? 'red' : 'slate'} hint={`${o.licences.expirent_sous_7_jours} sous 7 jours`} />
        </button>
      </KpiGrid>

      <KpiGrid cols={{ base: 3 }}>
        <StatTile label="Utilisateurs" value={o.activite.utilisateurs_actifs} />
        <StatTile label="Points de vente" value={o.activite.points_de_vente} />
        <StatTile label="Collectes (mois)" value={o.encaissements.collectes_ce_mois} />
      </KpiGrid>

      <SectionTitle action={<BackOfficeLink path="/platform/registrations" />}>Dernières inscriptions</SectionTitle>
      <Card>
        <Card.Content className="divide-y divide-separator p-0">
          {o.dernieres_inscriptions.map((r) => (
            <div key={`${r.name}-${r.created_at}`} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                <p className="text-xs text-muted">{formatDateOnlyFR(r.created_at)}</p>
              </div>
              <OrgStatus status={r.status} />
            </div>
          ))}
        </Card.Content>
      </Card>
    </div>
  );
}

function RequestsView({ rows, onDone }: { rows: LicenseRequest[]; onDone: () => void }) {
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
      const res = await api<{ message: string }>('', { method: 'POST', body: JSON.stringify({ action, requestId: r.request_id }) });
      telegram()?.HapticFeedback?.notificationOccurred('success');
      toast.success(res.message);
      onDone();
    } catch (err) {
      telegram()?.HapticFeedback?.notificationOccurred('error');
      toast.error(err instanceof Error ? err.message : 'Action impossible.');
    } finally {
      setBusy(null);
    }
  };

  if (!rows.length) return <Empty icon={CheckCircle} text="Aucune demande en attente." />;
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle action={<BackOfficeLink path="/platform/license-requests" />}>{rows.length} demande{rows.length > 1 ? 's' : ''} en attente</SectionTitle>
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
            {r.contact_name && <p>Contact : {r.contact_name}{r.phone ? ` · ${r.phone}` : ''}</p>}
            <p>
              Licence actuelle : {r.forfait_actuel ? `${r.forfait_actuel}${r.fin_licence_actuelle ? `, jusqu'au ${formatDateOnlyFR(r.fin_licence_actuelle)}` : ''}` : 'aucune'}
            </p>
            <p>Demandée le {formatDateOnlyFR(r.created_at)}{r.demande_par ? ` par ${r.demande_par}` : ''}</p>
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

function ClientsView() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Organization[] | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api<{ organisations: Organization[] }>(`?view=clients&q=${encodeURIComponent(q)}`)
        .then((d) => setRows(d.organisations))
        .catch((err) => toast.error(err.message));
    }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 rounded-2xl bg-surface px-4 py-3 shadow-surface">
        <Search className="size-4 text-muted" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un client"
          aria-label="Rechercher un client"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
      </label>
      {rows === null ? (
        <Loading />
      ) : !rows.length ? (
        <Empty icon={Building2} text="Aucun client trouvé." />
      ) : (
        <Card>
          <Card.Content className="divide-y divide-separator p-0">
            {rows.map((o) => (
              <button
                type="button"
                key={o.id}
                onClick={() => openBackOffice(`/platform/clients/${o.id}`)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{o.name}</p>
                  <p className="truncate text-xs text-muted">
                    {o.forfait ? `${o.forfait}${o.fin_licence ? ` · jusqu'au ${formatDateOnlyFR(o.fin_licence)}` : ''}` : 'Sans licence'}
                    {' · '}
                    {o.utilisateurs} util. · {o.points_de_vente} PDV
                  </p>
                </div>
                <OrgStatus status={o.status} />
              </button>
            ))}
          </Card.Content>
        </Card>
      )}
    </div>
  );
}

function ExpiringView({ data }: { data: Expiring }) {
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle action={<BackOfficeLink path="/platform/subscriptions/expiring" />}>Expirent sous 30 jours</SectionTitle>
      {data.expirent_bientot.length ? (
        <Card>
          <Card.Content className="divide-y divide-separator p-0">
            {data.expirent_bientot.map((r) => (
              <div key={`${r.organisation}-${r.fin}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{r.organisation}</p>
                  <p className="truncate text-xs text-muted">
                    {r.forfait ?? '—'} · {formatDateOnlyFR(r.fin)}{r.phone ? ` · ${r.phone}` : ''}
                  </p>
                </div>
                <Badge variant={r.jours_restants <= 7 ? 'danger' : 'warning'}>
                  {r.jours_restants <= 0 ? "Aujourd'hui" : `J-${r.jours_restants}`}
                </Badge>
              </div>
            ))}
          </Card.Content>
        </Card>
      ) : (
        <Empty icon={CheckCircle} text="Aucune licence n'expire dans les 30 jours." />
      )}

      <SectionTitle>Expirées sans renouvellement</SectionTitle>
      {data.deja_expirees_sans_renouvellement.length ? (
        <Card>
          <Card.Content className="divide-y divide-separator p-0">
            {data.deja_expirees_sans_renouvellement.map((r) => (
              <div key={`${r.organisation}-${r.expiree_le}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{r.organisation}</p>
                  <p className="truncate text-xs text-muted">
                    {r.dernier_forfait ?? '—'}{r.phone ? ` · ${r.phone}` : ''}
                  </p>
                </div>
                <Badge variant="neutral">{formatDateOnlyFR(r.expiree_le)}</Badge>
              </div>
            ))}
          </Card.Content>
        </Card>
      ) : (
        <Empty icon={CheckCircle} text="Aucun client expiré." />
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: 'Accueil', icon: LayoutDashboard },
  { id: 'requests', label: 'Demandes', icon: Inbox },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'expiring', label: 'Licences', icon: CalendarClock },
];

export default function TelegramMiniApp() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [requests, setRequests] = useState<LicenseRequest[] | null>(null);
  const [expiring, setExpiring] = useState<Expiring | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const init = useCallback(() => {
    const tg = telegram();
    if (tg) {
      tg.ready();
      tg.expand();
      applyTheme(tg);
      tg.onEvent('themeChanged', () => applyTheme(tg));
    }
    setReady(true);
  }, []);

  /** Lit les données d'un onglet ; renvoie la mise à jour à appliquer (ou l'erreur). */
  const fetchTab = useCallback(async (which: Tab): Promise<() => void> => {
    try {
      if (which === 'home') {
        const d = await api<Overview>('?view=overview');
        return () => { setOverview(d); setError(null); };
      }
      if (which === 'requests') {
        const d = await api<{ demandes: LicenseRequest[] }>('?view=requests');
        return () => { setRequests(d.demandes); setError(null); };
      }
      if (which === 'expiring') {
        const d = await api<Expiring>('?view=expiring');
        return () => { setExpiring(d); setError(null); };
      }
      return () => setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inattendue.';
      return () => setError(message);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetchTab(tab).then((apply) => {
      if (!cancelled) apply();
    });
    return () => {
      cancelled = true;
    };
  }, [ready, tab, fetchTab]);

  const refresh = async () => {
    setRefreshing(true);
    (await fetchTab(tab))();
    setRefreshing(false);
  };

  const title = TABS.find((t) => t.id === tab)?.label ?? 'OptiSpace';

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" onReady={init} onError={() => setReady(true)} />
      <div className="min-h-dvh bg-background pb-24">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-separator bg-surface/95 px-4 py-3 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo.jpg" alt="" className="size-9 rounded-xl object-cover" />
            <div className="min-w-0">
              <p className="text-xs text-muted">OptiSpace · Super admin</p>
              <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
            </div>
          </div>
          {tab !== 'clients' && (
            <Button variant="ghost" size="sm" isIconOnly icon={RefreshCw} aria-label="Actualiser" isLoading={refreshing} onClick={refresh} />
          )}
        </header>

        <main className="mx-auto flex max-w-xl flex-col gap-4 p-4">
          {error ? (
            <Card>
              <Card.Content className="flex flex-col items-center gap-3 py-8 text-center">
                <AlertTriangle className="size-8 text-warning" aria-hidden />
                <p className="text-sm text-foreground">{error}</p>
                <Button variant="secondary" size="sm" icon={RefreshCw} onClick={refresh}>
                  Réessayer
                </Button>
              </Card.Content>
            </Card>
          ) : !ready ? (
            <Loading />
          ) : tab === 'home' ? (
            overview ? <HomeView data={overview} goTo={setTab} /> : <Loading />
          ) : tab === 'requests' ? (
            requests ? <RequestsView rows={requests} onDone={() => void fetchTab('requests').then((apply) => apply())} /> : <Loading />
          ) : tab === 'clients' ? (
            <ClientsView />
          ) : expiring ? (
            <ExpiringView data={expiring} />
          ) : (
            <Loading />
          )}
        </main>

        <nav aria-label="Navigation de la Mini App" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-surface/95 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-xl items-stretch gap-1 px-2">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus',
                    active ? 'font-medium text-accent' : 'text-muted'
                  )}
                >
                  <span className={cn('relative flex h-7 w-12 items-center justify-center rounded-full transition-colors', active && 'bg-accent-soft')}>
                    <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                    {t.id === 'requests' && !!overview?.pendingRequests && (
                      <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-danger-foreground">
                        {overview.pendingRequests}
                      </span>
                    )}
                  </span>
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </>
  );
}
