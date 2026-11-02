// ============================================================
// OPTIWIFI - État du système (back-office super admin)
// Vérifie la base de données, les API, les notifications, le serveur et les tâches
// planifiées. Ne renvoie que des états et des messages : jamais de secret ni de donnée
// personnelle. Les erreurs et échecs d'envoi sont journalisés dans system_errors.
// ============================================================
import { query } from '@/lib/neon/db';
import { getEnvironmentSummary } from '@/lib/env-guard';
import { checkTelegram, WEBHOOK_PATH } from '@/lib/bot-health';
import { hydrateTelegramEnv } from '@/lib/integration-secrets';
import { isEmailConfigured, verifyEmailTransport } from '@/lib/email';
import { notifySuperAdmins } from '@/lib/notifications';

export { recordCronRun, recordSystemError } from '@/lib/system-errors';

export type SystemStatus = 'ok' | 'warning' | 'error';

export interface SystemCheck {
  label: string;
  status: SystemStatus;
  message: string;
}

export interface SystemComponent {
  id: 'database' | 'api' | 'notifications' | 'server' | 'vercel' | 'crons';
  label: string;
  status: SystemStatus;
  summary: string;
  metrics: { label: string; value: string }[];
  checks: SystemCheck[];
}

export interface SystemErrorRow {
  occurred_at: string;
  source: string;
  route: string | null;
  message: string;
  status: number | null;
}

export interface SystemHealth {
  overall: SystemStatus;
  checked_at: string;
  components: SystemComponent[];
  recent_errors: SystemErrorRow[];
}

const RANK: Record<SystemStatus, number> = { ok: 0, warning: 1, error: 2 };
const worst = (list: SystemStatus[]): SystemStatus => list.reduce<SystemStatus>((a, b) => (RANK[b] > RANK[a] ? b : a), 'ok');

/** Tâches planifiées suivies (vercel.json) et délai au-delà duquel elles sont en retard */
export const CRON_JOBS: { name: string; label: string; maxAgeHours: number }[] = [
  { name: 'licence-reminders', label: 'Rappels de licence', maxAgeHours: 26 },
  { name: 'health-check', label: 'Contrôle de santé', maxAgeHours: 26 },
];

// ── Vérifications ──────────────────────────────────────────────────────────

const fmtMs = (ms: number) => `${Math.round(ms)} ms`;
const fmtSize = (bytes: number) => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} Go` : `${(bytes / 1024 ** 2).toFixed(1)} Mo`);
const ago = (date: Date) => {
  const min = Math.round((Date.now() - date.getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`;
};

async function checkDatabase(): Promise<SystemComponent> {
  const checks: SystemCheck[] = [];
  const metrics: SystemComponent['metrics'] = [];

  const start = Date.now();
  try {
    await query('SELECT 1');
  } catch {
    return {
      id: 'database',
      label: 'Base de données',
      status: 'error',
      summary: 'Base injoignable',
      metrics: [],
      checks: [{ label: 'Connexion', status: 'error', message: 'La base ne répond pas' }],
    };
  }
  const latency = Date.now() - start;
  metrics.push({ label: 'Temps de réponse', value: fmtMs(latency) });
  checks.push({
    label: 'Connexion',
    status: latency > 1500 ? 'error' : latency > 500 ? 'warning' : 'ok',
    message: latency > 500 ? `Réponse lente (${fmtMs(latency)})` : `Répond en ${fmtMs(latency)}`,
  });

  const env = getEnvironmentSummary(process.env.DATABASE_URL);
  checks.push({
    label: 'Bonne base',
    status: env.isIsolated ? 'ok' : 'error',
    message: env.isIsolated
      ? env.isProduction
        ? 'Production → base de production'
        : 'Hors production → base de développement'
      : 'Environnement et base ne correspondent pas',
  });

  try {
    const { rows } = await query(
      `SELECT pg_database_size(current_database())::bigint AS size,
              (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database())::int AS connections,
              (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_connections`
    );
    const r = rows[0];
    metrics.push({ label: 'Taille', value: fmtSize(Number(r.size)) });
    metrics.push({ label: 'Connexions', value: `${r.connections} / ${r.max_connections}` });
    const usage = (Number(r.connections) / Number(r.max_connections)) * 100;
    checks.push({
      label: 'Connexions',
      status: usage > 90 ? 'error' : usage > 75 ? 'warning' : 'ok',
      message: `${Math.round(usage)} % des connexions utilisées`,
    });
  } catch {
    checks.push({ label: 'Statistiques', status: 'warning', message: 'Statistiques de la base indisponibles' });
  }

  try {
    const { rows } = await query(
      `SELECT count(*)::int AS n FROM pg_stat_statements WHERE mean_exec_time > 1000 AND calls > 5`
    );
    const n = Number(rows[0]?.n || 0);
    checks.push({
      label: 'Requêtes lentes',
      status: n > 0 ? 'warning' : 'ok',
      message: n > 0 ? `${n} requête(s) de plus d'une seconde en moyenne` : 'Aucune requête lente',
    });
  } catch {
    // pg_stat_statements non installé : vérification ignorée
  }

  const status = worst(checks.map((c) => c.status));
  return {
    id: 'database',
    label: 'Base de données',
    status,
    summary: status === 'ok' ? `Opérationnelle · ${fmtMs(latency)}` : checks.find((c) => c.status === status)!.message,
    metrics,
    checks,
  };
}

async function errorCounts(source: string): Promise<{ hour: number; day: number }> {
  const { rows } = await query(
    `SELECT count(*) FILTER (WHERE occurred_at > NOW() - interval '1 hour')::int AS hour,
            count(*)::int AS day
       FROM system_errors WHERE source = $1 AND occurred_at > NOW() - interval '24 hours'`,
    [source]
  );
  return { hour: Number(rows[0]?.hour || 0), day: Number(rows[0]?.day || 0) };
}

async function checkApi(): Promise<SystemComponent> {
  const { hour, day } = await errorCounts('api');
  const status: SystemStatus = hour >= 10 ? 'error' : hour > 0 || day >= 20 ? 'warning' : 'ok';
  return {
    id: 'api',
    label: 'API',
    status,
    summary: hour > 0 ? `${hour} erreur(s) serveur dans la dernière heure` : day > 0 ? `${day} erreur(s) en 24 h, aucune depuis 1 h` : 'Aucune erreur serveur',
    metrics: [
      { label: 'Erreurs (1 h)', value: String(hour) },
      { label: 'Erreurs (24 h)', value: String(day) },
    ],
    checks: [
      {
        label: 'Erreurs serveur',
        status,
        message: day === 0 ? 'Aucune erreur dans les dernières 24 h' : `${hour} sur la dernière heure, ${day} sur 24 h`,
      },
    ],
  };
}

async function checkNotifications(siteOrigin: string): Promise<SystemComponent> {
  const checks: SystemCheck[] = [];
  const metrics: SystemComponent['metrics'] = [];

  // Telegram (alertes du super admin, bot)
  try {
    await hydrateTelegramEnv();
    const telegram = await checkTelegram(`${siteOrigin}${WEBHOOK_PATH}`);
    for (const t of telegram.filter((x) => x.id === 'telegram' || x.id === 'telegram_webhook')) {
      checks.push({
        label: t.label,
        status: t.status === 'missing' ? 'warning' : t.status,
        message: t.message,
      });
    }
  } catch {
    checks.push({ label: 'Bot Telegram', status: 'error', message: 'Vérification impossible' });
  }

  // E-mails
  if (!isEmailConfigured()) {
    checks.push({ label: 'E-mails (SMTP)', status: 'warning', message: 'Envoi non configuré : les e-mails ne partent pas' });
  } else {
    const verified = await verifyEmailTransport();
    checks.push({
      label: 'E-mails (SMTP)',
      status: verified.ok ? 'ok' : 'error',
      message: verified.ok ? 'Serveur d’envoi joignable' : 'Serveur d’envoi injoignable ou identifiants refusés',
    });
  }

  // Push navigateur
  const vapid = !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  try {
    const { rows } = await query(
      `SELECT (SELECT count(*) FROM push_subscriptions)::int AS subs,
              (SELECT count(*) FROM notifications WHERE created_at > NOW() - interval '24 hours')::int AS sent`
    );
    metrics.push({ label: 'Appareils abonnés (push)', value: String(rows[0].subs) });
    metrics.push({ label: 'Notifications (24 h)', value: String(rows[0].sent) });
  } catch {
    // tables absentes : ignoré
  }
  checks.push({
    label: 'Notifications push',
    status: vapid ? 'ok' : 'warning',
    message: vapid ? 'Clés configurées' : 'Clés VAPID absentes : pas de notification sur les téléphones',
  });

  // Échecs d'envoi journalisés
  const [push, email, telegram] = await Promise.all([errorCounts('push'), errorCounts('email'), errorCounts('telegram')]);
  const failures = push.day + email.day + telegram.day;
  metrics.push({ label: 'Échecs d’envoi (24 h)', value: String(failures) });
  if (failures > 0) {
    const parts = [
      push.day ? `${push.day} push` : '',
      email.day ? `${email.day} e-mail(s)` : '',
      telegram.day ? `${telegram.day} Telegram` : '',
    ].filter(Boolean);
    checks.push({ label: 'Échecs d’envoi', status: 'warning', message: `${parts.join(', ')} en échec sur 24 h` });
  }

  const status = worst(checks.map((c) => c.status));
  const problems = checks.filter((c) => c.status !== 'ok').length;
  return {
    id: 'notifications',
    label: 'Notifications',
    status,
    summary: problems === 0 ? 'Tous les canaux fonctionnent' : `${problems} point(s) à vérifier`,
    metrics,
    checks,
  };
}

function checkServer(): SystemComponent {
  const env = getEnvironmentSummary(process.env.DATABASE_URL);
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  const commitMessage = process.env.VERCEL_GIT_COMMIT_MESSAGE?.split('\n')[0];
  const label: Record<string, string> = {
    production: 'Production',
    preview: 'Préversion',
    development: 'Développement local',
    test: 'Test',
  };
  const metrics = [
    { label: 'Environnement', value: label[env.runtimeEnv] || env.runtimeEnv },
    { label: 'Version', value: sha ? `${sha}${commitMessage ? ` · ${commitMessage.slice(0, 60)}` : ''}` : 'locale' },
    { label: 'Région', value: process.env.VERCEL_REGION || 'locale' },
    { label: 'Node.js', value: process.version },
  ];
  return {
    id: 'server',
    label: 'Serveur',
    status: 'ok',
    summary: `${label[env.runtimeEnv] || env.runtimeEnv}${sha ? ` · version ${sha}` : ''}`,
    metrics,
    checks: [{ label: 'Application', status: 'ok', message: 'Répond aux requêtes' }],
  };
}

// Projet Vercel d'OptiSpace (identifiants publics, comme dans lib/bot/admin-data.ts)
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_sYLBGlV8d7PBEEiDbwJbq9qm9fdy';
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || 'team_qOt460YjW0wgC8CZKSpSFzE5';

interface VercelDeployment {
  readyState?: string;
  state?: string;
  createdAt?: number;
  created?: number;
  meta?: Record<string, string>;
}

const DEPLOY_STATE: Record<string, { status: SystemStatus; label: string }> = {
  READY: { status: 'ok', label: 'En ligne' },
  ERROR: { status: 'error', label: 'En échec' },
  BUILDING: { status: 'warning', label: 'Déploiement en cours' },
  INITIALIZING: { status: 'warning', label: 'Déploiement en cours' },
  QUEUED: { status: 'warning', label: 'En file d’attente' },
  CANCELED: { status: 'warning', label: 'Annulé' },
};

async function vercelGet<T>(path: string, token: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://api.vercel.com${path}${sep}teamId=${VERCEL_TEAM_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (res.status === 401 || res.status === 403) throw new Error('auth');
  if (!res.ok) throw new Error(`http ${res.status}`);
  return (await res.json()) as T;
}

/** Hébergement Vercel : dernier déploiement de production, préversion, échecs récents, domaines */
async function checkVercel(): Promise<SystemComponent> {
  const base = { id: 'vercel' as const, label: 'Vercel (hébergement)' };
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) {
    return {
      ...base,
      status: 'warning',
      summary: 'Suivi des déploiements non configuré',
      metrics: [],
      checks: [{ label: 'Accès à Vercel', status: 'warning', message: 'VERCEL_TOKEN absent sur ce déploiement : état des déploiements inconnu' }],
    };
  }

  let production: VercelDeployment[];
  let preview: VercelDeployment[];
  let domains: { name: string; verified?: boolean }[];
  try {
    const since = Date.now() - 24 * 3600 * 1000;
    [production, preview, domains] = await Promise.all([
      vercelGet<{ deployments: VercelDeployment[] }>(`/v6/deployments?projectId=${VERCEL_PROJECT_ID}&target=production&limit=20&since=${since}`, token)
        .then(async (r) =>
          r.deployments.length > 0
            ? r.deployments
            : (await vercelGet<{ deployments: VercelDeployment[] }>(`/v6/deployments?projectId=${VERCEL_PROJECT_ID}&target=production&limit=1`, token)).deployments
        ),
      vercelGet<{ deployments: VercelDeployment[] }>(`/v6/deployments?projectId=${VERCEL_PROJECT_ID}&target=preview&limit=1`, token).then((r) => r.deployments),
      vercelGet<{ domains: { name: string; verified?: boolean }[] }>(`/v9/projects/${VERCEL_PROJECT_ID}/domains`, token).then((r) => r.domains || []),
    ]);
  } catch (err) {
    const auth = err instanceof Error && err.message === 'auth';
    const timeout = err instanceof Error && err.name === 'TimeoutError';
    return {
      ...base,
      status: 'error',
      summary: auth ? 'Jeton Vercel refusé' : 'Vercel injoignable',
      metrics: [],
      checks: [
        {
          label: 'Accès à Vercel',
          status: 'error',
          message: auth
            ? 'VERCEL_TOKEN expiré ou sans accès à l’équipe : à régénérer sur vercel.com/account/tokens'
            : timeout
              ? 'Pas de réponse de Vercel (délai dépassé)'
              : 'Vercel ne répond pas',
        },
      ],
    };
  }

  const checks: SystemCheck[] = [];
  const metrics: SystemComponent['metrics'] = [];
  const describe = (d: VercelDeployment) => {
    const at = new Date(d.createdAt || d.created || 0);
    const sha = d.meta?.githubCommitSha?.slice(0, 7);
    return { at, text: `${ago(at)}${sha ? ` · ${sha}` : ''}${d.meta?.githubCommitMessage ? ` · ${d.meta.githubCommitMessage.split('\n')[0].slice(0, 50)}` : ''}` };
  };

  // Production : le dernier déploiement doit être en ligne
  const lastProd = production[0];
  if (!lastProd) {
    checks.push({ label: 'Production', status: 'warning', message: 'Aucun déploiement de production trouvé' });
  } else {
    const state = DEPLOY_STATE[lastProd.readyState || lastProd.state || ''] ?? { status: 'warning' as SystemStatus, label: lastProd.readyState || 'Inconnu' };
    const d = describe(lastProd);
    checks.push({ label: 'Production', status: state.status, message: `${state.label} · ${d.text}` });
    metrics.push({ label: 'Dernier déploiement', value: ago(d.at) });
  }

  // Déploiements de production en échec sur 24 h (le site reste sur la version précédente)
  const failed = production.filter((d) => (d.readyState || d.state) === 'ERROR' && (d.createdAt || d.created || 0) > Date.now() - 24 * 3600 * 1000);
  metrics.push({ label: 'Échecs (24 h)', value: String(failed.length) });
  if (failed.length > 0 && lastProd && (lastProd.readyState || lastProd.state) !== 'ERROR') {
    checks.push({
      label: 'Déploiements en échec',
      status: 'warning',
      message: `${failed.length} échec(s) sur 24 h : le site est resté sur la version précédente`,
    });
  }

  // Préversion (develop) : informatif, un échec ne touche pas le site en ligne
  const lastPreview = preview[0];
  if (lastPreview) {
    const state = DEPLOY_STATE[lastPreview.readyState || lastPreview.state || ''] ?? { status: 'warning' as SystemStatus, label: 'Inconnu' };
    const d = describe(lastPreview);
    const branch = lastPreview.meta?.githubCommitRef;
    checks.push({
      label: `Préversion${branch ? ` (${branch})` : ''}`,
      status: state.status === 'error' ? 'warning' : 'ok',
      message: `${state.label} · ${d.text}`,
    });
  }

  // Domaines du projet
  const unverified = domains.filter((d) => d.verified === false);
  metrics.push({ label: 'Domaines', value: `${domains.length - unverified.length} / ${domains.length} vérifiés` });
  checks.push({
    label: 'Domaines',
    status: unverified.length > 0 ? 'error' : 'ok',
    message: unverified.length > 0 ? `Non vérifié : ${unverified.map((d) => d.name).join(', ')}` : domains.map((d) => d.name).join(', ') || 'Aucun domaine',
  });

  const status = worst(checks.map((c) => c.status));
  return {
    ...base,
    status,
    summary: status === 'ok' ? `Production en ligne${lastProd ? ` · déployée ${describe(lastProd).text.split(' · ')[0]}` : ''}` : checks.find((c) => c.status === status)!.message,
    metrics,
    checks,
  };
}

async function checkCrons(): Promise<SystemComponent> {
  const { rows } = await query('SELECT name, last_run_at, ok, message FROM system_cron_runs');
  const byName = new Map(rows.map((r) => [r.name as string, r]));
  const checks: SystemCheck[] = CRON_JOBS.map((job) => {
    const run = byName.get(job.name);
    if (!run) return { label: job.label, status: 'ok', message: 'En attente de sa première exécution suivie' };
    const at = new Date(run.last_run_at);
    const late = Date.now() - at.getTime() > job.maxAgeHours * 3600 * 1000;
    if (!run.ok) return { label: job.label, status: 'error', message: `Dernière exécution en échec (${ago(at)})` };
    if (late) return { label: job.label, status: 'warning', message: `En retard : dernière exécution ${ago(at)}` };
    return { label: job.label, status: 'ok', message: `Exécutée ${ago(at)}${run.message ? ` · ${run.message}` : ''}` };
  });
  const status = worst(checks.map((c) => c.status));
  const problems = checks.filter((c) => c.status !== 'ok').length;
  return {
    id: 'crons',
    label: 'Tâches planifiées',
    status,
    summary: problems === 0 ? 'Toutes à l’heure' : `${problems} tâche(s) à vérifier`,
    metrics: [],
    checks,
  };
}

/** Exécute tous les contrôles (en parallèle, chacun isolé) */
export async function runSystemHealth(siteOrigin: string): Promise<SystemHealth> {
  const safe = async (id: SystemComponent['id'], label: string, fn: () => Promise<SystemComponent> | SystemComponent) => {
    try {
      return await fn();
    } catch {
      return { id, label, status: 'error', summary: 'Vérification impossible', metrics: [], checks: [] } as SystemComponent;
    }
  };
  const components = await Promise.all([
    safe('database', 'Base de données', checkDatabase),
    safe('api', 'API', checkApi),
    safe('notifications', 'Notifications', () => checkNotifications(siteOrigin)),
    safe('server', 'Serveur', checkServer),
    safe('vercel', 'Vercel (hébergement)', checkVercel),
    safe('crons', 'Tâches planifiées', checkCrons),
  ]);

  let recent_errors: SystemErrorRow[] = [];
  try {
    const { rows } = await query(
      `SELECT occurred_at, source, route, message, status FROM system_errors ORDER BY occurred_at DESC LIMIT 15`
    );
    recent_errors = rows as SystemErrorRow[];
  } catch {
    // journal indisponible
  }

  return {
    overall: worst(components.map((c) => c.status)),
    checked_at: new Date().toISOString(),
    components,
    recent_errors,
  };
}

// ── Historique et alertes ──────────────────────────────────────────────────

export interface HealthSnapshot {
  checked_at: string;
  overall: SystemStatus;
  components: { id: string; status: SystemStatus; summary?: string }[];
}

/**
 * Enregistre le résultat et renvoie les composants dont l'état a changé depuis le contrôle
 * précédent (pour n'alerter qu'au changement, pas à chaque contrôle).
 */
export async function storeHealth(
  health: SystemHealth,
  source: 'cron' | 'manual',
  minIntervalMs = 0
): Promise<{ stored: boolean; changed: { component: SystemComponent; previous: SystemStatus | null }[] }> {
  const previous = await query(`SELECT components FROM system_health_checks ORDER BY checked_at DESC LIMIT 1`);
  const before = new Map<string, SystemStatus>(
    ((previous.rows[0]?.components as HealthSnapshot['components']) || []).map((c) => [c.id, c.status])
  );
  // Une seule ligne par intervalle, même si plusieurs pages ouvertes vérifient en même temps
  const inserted = await query(
    `INSERT INTO system_health_checks (overall, components, source)
     SELECT $1, $2::jsonb, $3
      WHERE NOT EXISTS (
        SELECT 1 FROM system_health_checks WHERE checked_at > NOW() - make_interval(secs => $4::double precision / 1000)
      )
     RETURNING id`,
    [
      health.overall,
      JSON.stringify(health.components.map((c) => ({ id: c.id, status: c.status, summary: c.summary }))),
      source,
      minIntervalMs,
    ]
  );
  if (inserted.rows.length === 0) return { stored: false, changed: [] };
  // Conservation : 30 jours
  await query(`DELETE FROM system_health_checks WHERE checked_at < NOW() - interval '30 days'`);
  await query(`DELETE FROM system_errors WHERE occurred_at < NOW() - interval '30 days'`);

  const changed = health.components
    .filter((c) => (before.get(c.id) ?? 'ok') !== c.status)
    .map((c) => ({ component: c, previous: before.get(c.id) ?? null }));
  return { stored: true, changed };
}

/** Historique des dernières 24 h ou 7 jours (pour la frise de chaque composant) */
export async function healthHistory(hours: number): Promise<HealthSnapshot[]> {
  const { rows } = await query(
    `SELECT checked_at, overall, components FROM system_health_checks
      WHERE checked_at > NOW() - make_interval(hours => $1) ORDER BY checked_at ASC`,
    [hours]
  );
  return rows as HealthSnapshot[];
}

/** Dernier contrôle enregistré (carte du tableau de bord) */
export async function lastStoredHealth(): Promise<HealthSnapshot | null> {
  const { rows } = await query(`SELECT checked_at, overall, components FROM system_health_checks ORDER BY checked_at DESC LIMIT 1`);
  return (rows[0] as HealthSnapshot) ?? null;
}

const STATUS_WORD: Record<SystemStatus, string> = { ok: 'rétabli', warning: 'à surveiller', error: 'en panne' };
/** Intervalle minimal entre deux enregistrements depuis la page (les contrôles restent en direct) */
const MANUAL_STORE_EVERY_MS = 5 * 60 * 1000;

/**
 * Contrôle complet + enregistrement dans l'historique + alerte du super admin (notification,
 * push, Telegram) uniquement quand l'état d'un composant change.
 * Depuis la page (manual), l'enregistrement est limité à un toutes les 5 minutes.
 */
export async function checkAndRecord(siteOrigin: string, source: 'cron' | 'manual'): Promise<SystemHealth> {
  const health = await runSystemHealth(siteOrigin);
  const { changed } = await storeHealth(health, source, source === 'manual' ? MANUAL_STORE_EVERY_MS : 0);
  const broken = changed.filter((c) => c.component.status !== 'ok');
  const recovered = changed.filter((c) => c.component.status === 'ok');
  if (broken.length > 0) {
    await notifySuperAdmins({
      type: 'system.alert',
      title:
        broken.length === 1
          ? `${broken[0].component.label} : ${STATUS_WORD[broken[0].component.status]}`
          : `${broken.length} composants à vérifier`,
      body: broken.map((c) => `${c.component.label} — ${c.component.summary}`).join('\n'),
      link: '/platform/system',
    });
  }
  if (recovered.length > 0) {
    await notifySuperAdmins({
      type: 'system.recovered',
      title: `${recovered.map((c) => c.component.label).join(', ')} : rétabli`,
      body: recovered.map((c) => `${c.component.label} — ${c.component.summary}`).join('\n'),
      link: '/platform/system',
    });
  }
  return health;
}
