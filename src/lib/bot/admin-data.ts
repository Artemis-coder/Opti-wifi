// ============================================================
// OPTIWIFI - Données du bot super admin (lecture seule, requêtes fixes et paramétrées).
// Le modèle d'IA n'écrit jamais de SQL : il choisit un outil et ses paramètres.
// ============================================================
import { query } from '@/lib/neon/db';
import { UUID_RE } from '@/lib/platform-actions';

const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_sYLBGlV8d7PBEEiDbwJbq9qm9fdy';
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || 'team_qOt460YjW0wgC8CZKSpSFzE5';

const LIVE_LICENCE = `s.status IN ('active', 'trialing') AND (s.end_date IS NULL OR s.end_date > NOW())`;

/** Licence en cours (ou la plus récente) de chaque organisation. */
const CURRENT_SUB_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT s.id, s.status, s.start_date, s.end_date, p.name AS plan, p.price, p.currency,
           (${LIVE_LICENCE}) AS live
      FROM subscriptions s LEFT JOIN subscription_plans p ON p.id = s.plan_id
     WHERE s.organization_id = o.id
     ORDER BY (${LIVE_LICENCE}) DESC, s.end_date DESC NULLS LAST
     LIMIT 1
  ) cur ON true`;

export type OrgResolution =
  | { ok: true; id: string; name: string }
  | { ok: false; error: string; candidates?: { id: string; name: string; status: string }[] };

/** Retrouve une organisation par identifiant ou par nom (approximatif). */
export async function resolveOrganization(ref: string): Promise<OrgResolution> {
  const value = (ref || '').trim();
  if (!value) return { ok: false, error: 'Organisation non précisée.' };
  if (UUID_RE.test(value)) {
    const { rows } = await query('SELECT id, name FROM organizations WHERE id = $1', [value]);
    return rows[0] ? { ok: true, id: rows[0].id, name: rows[0].name } : { ok: false, error: 'Organisation introuvable.' };
  }
  const { rows } = await query(
    `SELECT id, name, status FROM organizations
      WHERE name ILIKE $1 OR email ILIKE $1 OR contact_name ILIKE $1
      ORDER BY (lower(name) = lower($2)) DESC, created_at DESC LIMIT 6`,
    [`%${value.replace(/[%_\\]/g, '\\$&')}%`, value]
  );
  if (rows.length === 0) return { ok: false, error: `Aucune organisation ne correspond à « ${value} ».` };
  const exact = rows.find((r) => r.name.toLowerCase() === value.toLowerCase());
  if (exact || rows.length === 1) {
    const r = exact || rows[0];
    return { ok: true, id: r.id, name: r.name };
  }
  return { ok: false, error: `Plusieurs organisations correspondent à « ${value} » : précisez laquelle.`, candidates: rows };
}

export async function getPlatformOverview() {
  const [orgs, licences, requests, money, users, recent] = await Promise.all([
    query(`SELECT status, COUNT(*)::int AS n FROM organizations GROUP BY status ORDER BY 2 DESC`),
    query(
      `SELECT
         COUNT(DISTINCT s.organization_id) FILTER (WHERE ${LIVE_LICENCE})::int AS organisations_avec_licence_active,
         COUNT(*) FILTER (WHERE ${LIVE_LICENCE} AND s.end_date < NOW() + interval '7 days')::int AS expirent_sous_7_jours,
         COUNT(*) FILTER (WHERE ${LIVE_LICENCE} AND s.end_date < NOW() + interval '30 days')::int AS expirent_sous_30_jours,
         COUNT(*) FILTER (WHERE s.end_date BETWEEN NOW() - interval '30 days' AND NOW())::int AS expirees_ces_30_derniers_jours
       FROM subscriptions s`
    ),
    query(`SELECT status, COUNT(*)::int AS n FROM license_requests GROUP BY status`),
    query(
      `SELECT
         COALESCE(SUM(montant_collecte) FILTER (WHERE COALESCE(date_collecte, created_at) >= date_trunc('month', NOW())), 0)::float AS encaisse_ce_mois,
         COALESCE(SUM(montant_collecte) FILTER (WHERE COALESCE(date_collecte, created_at) >= date_trunc('month', NOW()) - interval '1 month'
                                             AND COALESCE(date_collecte, created_at) < date_trunc('month', NOW())), 0)::float AS encaisse_mois_dernier,
         COUNT(*) FILTER (WHERE COALESCE(date_collecte, created_at) >= date_trunc('month', NOW()))::int AS collectes_ce_mois
       FROM collections`
    ),
    query(
      `SELECT
         (SELECT COUNT(*) FROM profiles WHERE deleted_at IS NULL AND is_active IS NOT FALSE)::int AS utilisateurs_actifs,
         (SELECT COUNT(*) FROM points_of_sale)::int AS points_de_vente,
         (SELECT COUNT(*) FROM wifi_spaces)::int AS espaces_wifi,
         (SELECT COUNT(*) FROM users WHERE last_sign_in_at > NOW() - interval '7 days')::int AS connectes_7_derniers_jours`
    ),
    query(`SELECT name, status, created_at FROM organizations ORDER BY created_at DESC LIMIT 5`),
  ]);
  return {
    organisations_par_statut: orgs.rows,
    licences: licences.rows[0],
    demandes_de_licence_par_statut: requests.rows,
    encaissements: { ...money.rows[0], devise: 'FCFA' },
    activite: users.rows[0],
    dernieres_inscriptions: recent.rows,
  };
}

export async function listOrganizations(args: { status?: string; search?: string; limit?: number }) {
  const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
  const search = args.search?.trim() ? `%${args.search.trim().replace(/[%_\\]/g, '\\$&')}%` : null;
  const { rows } = await query(
    `SELECT o.id, o.name, o.status, o.contact_name, o.email, o.phone, o.created_at,
            cur.plan AS forfait, cur.status AS statut_licence, cur.end_date AS fin_licence, cur.live AS licence_active,
            (SELECT COUNT(*) FROM profiles p WHERE p.organization_id = o.id AND p.deleted_at IS NULL)::int AS utilisateurs,
            (SELECT COUNT(*) FROM points_of_sale pos WHERE pos.organization_id = o.id)::int AS points_de_vente,
            (SELECT MAX(COALESCE(c.date_collecte, c.created_at)) FROM collections c
              WHERE COALESCE(c.organization_id, c.organisation_id) = o.id) AS derniere_collecte
       FROM organizations o
       ${CURRENT_SUB_LATERAL}
      WHERE ($1::text IS NULL OR o.status::text = $1)
        AND ($2::text IS NULL OR o.name ILIKE $2 OR o.email ILIKE $2 OR o.contact_name ILIKE $2)
      ORDER BY o.created_at DESC
      LIMIT $3`,
    [args.status || null, search, limit]
  );
  return { total: rows.length, organisations: rows };
}

export async function getOrganizationDetails(args: { organization: string }) {
  const org = await resolveOrganization(args.organization);
  if (!org.ok) return org;
  const id = org.id;
  const [info, subs, members, pos, spaces, money, lastCollections, tickets, requests] = await Promise.all([
    query(`SELECT id, name, status, contact_name, email, phone, address, currency, created_at FROM organizations WHERE id = $1`, [id]),
    query(
      `SELECT p.name AS forfait, s.status, s.start_date, s.end_date, s.created_at
         FROM subscriptions s LEFT JOIN subscription_plans p ON p.id = s.plan_id
        WHERE s.organization_id = $1 ORDER BY s.created_at DESC LIMIT 6`,
      [id]
    ),
    query(
      `SELECT p.nom, p.email, p.role, p.telephone, (p.is_active IS NOT FALSE) AS actif, u.last_sign_in_at AS derniere_connexion
         FROM profiles p LEFT JOIN users u ON u.id = p.id
        WHERE p.organization_id = $1 AND p.deleted_at IS NULL ORDER BY p.created_at`,
      [id]
    ),
    query(`SELECT nom, ville, statut FROM points_of_sale WHERE organization_id = $1 ORDER BY nom`, [id]),
    query(`SELECT nom, ville, statut FROM wifi_spaces WHERE organization_id = $1 ORDER BY nom`, [id]),
    query(
      `SELECT COALESCE(SUM(montant_collecte), 0)::float AS encaisse_30_jours,
              COALESCE(SUM(montant_attendu), 0)::float AS attendu_30_jours,
              COALESCE(SUM(commission), 0)::float AS commissions_30_jours,
              COUNT(*)::int AS collectes_30_jours
         FROM collections
        WHERE COALESCE(organization_id, organisation_id) = $1
          AND COALESCE(date_collecte, created_at) > NOW() - interval '30 days'`,
      [id]
    ),
    query(
      `SELECT COALESCE(c.date_collecte, c.created_at) AS date, c.montant_collecte, c.montant_attendu, c.statut, pos.nom AS point_de_vente, pr.nom AS collecteur
         FROM collections c
         LEFT JOIN points_of_sale pos ON pos.id = c.pos_id
         LEFT JOIN profiles pr ON pr.id = c.collecteur_id
        WHERE COALESCE(c.organization_id, c.organisation_id) = $1
        ORDER BY COALESCE(c.date_collecte, c.created_at) DESC LIMIT 5`,
      [id]
    ),
    query(
      `SELECT COALESCE(SUM(a.quantite), 0)::int AS tickets_alloues_30_jours,
              COALESCE(SUM(a.quantite * t.prix), 0)::float AS valeur_tickets_30_jours
         FROM ticket_allocations a LEFT JOIN ticket_types t ON t.id = a.ticket_type_id
        WHERE a.organization_id = $1 AND COALESCE(a.date_allocation, a.created_at) > NOW() - interval '30 days'`,
      [id]
    ),
    query(
      `SELECT r.id, r.type, r.status, r.duration_months, p.name AS forfait, r.message, r.admin_note, r.created_at
         FROM license_requests r LEFT JOIN subscription_plans p ON p.id = r.plan_id
        WHERE r.organization_id = $1 ORDER BY r.created_at DESC LIMIT 5`,
      [id]
    ),
  ]);
  return {
    organisation: info.rows[0],
    licences: subs.rows,
    membres: members.rows,
    points_de_vente: pos.rows,
    espaces_wifi: spaces.rows,
    activite_30_jours: { ...money.rows[0], ...tickets.rows[0], devise: info.rows[0]?.currency || 'FCFA' },
    dernieres_collectes: lastCollections.rows,
    demandes_de_licence: requests.rows,
  };
}

export async function listLicenseRequests(args: { status?: string }) {
  const status = ['pending', 'approved', 'rejected', 'cancelled', 'all'].includes(args.status || '') ? args.status : 'pending';
  const { rows } = await query(
    `SELECT r.id AS request_id, r.type, r.status, r.duration_months, r.message, r.admin_note, r.created_at, r.processed_at,
            o.name AS organisation, o.status AS statut_organisation, o.contact_name, o.phone,
            p.name AS forfait_demande, p.price AS prix, p.currency AS devise, p.trial_days > 0 AS forfait_essai,
            pr.nom AS demande_par, cur.plan AS forfait_actuel, cur.end_date AS fin_licence_actuelle
       FROM license_requests r
       JOIN organizations o ON o.id = r.organization_id
       LEFT JOIN subscription_plans p ON p.id = r.plan_id
       LEFT JOIN profiles pr ON pr.id = r.requested_by
       ${CURRENT_SUB_LATERAL}
      WHERE ($1 = 'all' OR r.status = $1)
      ORDER BY r.created_at DESC LIMIT 30`,
    [status]
  );
  return { statut: status, total: rows.length, demandes: rows };
}

export async function listExpiringLicences(args: { days?: number }) {
  const days = Math.min(365, Math.max(1, Number(args.days) || 30));
  const [expiring, expired] = await Promise.all([
    query(
      `SELECT o.name AS organisation, o.contact_name, o.phone, p.name AS forfait, s.end_date AS fin,
              CEIL(EXTRACT(EPOCH FROM (s.end_date - NOW())) / 86400)::int AS jours_restants
         FROM subscriptions s JOIN organizations o ON o.id = s.organization_id
         LEFT JOIN subscription_plans p ON p.id = s.plan_id
        WHERE ${LIVE_LICENCE} AND s.end_date < NOW() + make_interval(days => $1)
          AND NOT EXISTS (SELECT 1 FROM subscriptions s2 WHERE s2.organization_id = s.organization_id AND s2.id <> s.id
                            AND s2.status IN ('active', 'trialing') AND s2.end_date > s.end_date)
        ORDER BY s.end_date`,
      [days]
    ),
    query(
      `SELECT DISTINCT ON (o.id) o.name AS organisation, o.contact_name, o.phone, p.name AS dernier_forfait, s.end_date AS expiree_le
         FROM organizations o JOIN subscriptions s ON s.organization_id = o.id
         LEFT JOIN subscription_plans p ON p.id = s.plan_id
        WHERE o.status NOT IN ('archived', 'cancelled')
          AND NOT EXISTS (SELECT 1 FROM subscriptions s2 WHERE s2.organization_id = o.id AND s2.status IN ('active', 'trialing')
                            AND (s2.end_date IS NULL OR s2.end_date > NOW()))
        ORDER BY o.id, s.end_date DESC`
    ),
  ]);
  return { fenetre_jours: days, expirent_bientot: expiring.rows, deja_expirees_sans_renouvellement: expired.rows };
}

const PERIODS: Record<string, [string, string]> = {
  today: [`date_trunc('day', NOW())`, `NOW()`],
  week: [`date_trunc('week', NOW())`, `NOW()`],
  month: [`date_trunc('month', NOW())`, `NOW()`],
  last_month: [`date_trunc('month', NOW()) - interval '1 month'`, `date_trunc('month', NOW())`],
  year: [`date_trunc('year', NOW())`, `NOW()`],
  last_30_days: [`NOW() - interval '30 days'`, `NOW()`],
};

export async function getRevenueReport(args: { period?: string; organization?: string }) {
  const period = PERIODS[args.period || ''] ? args.period! : 'month';
  const [from, to] = PERIODS[period];
  let orgId: string | null = null;
  if (args.organization) {
    const org = await resolveOrganization(args.organization);
    if (!org.ok) return org;
    orgId = org.id;
  }
  const where = `COALESCE(c.date_collecte, c.created_at) >= ${from} AND COALESCE(c.date_collecte, c.created_at) < ${to}
                 AND ($1::uuid IS NULL OR COALESCE(c.organization_id, c.organisation_id) = $1)`;
  const [totals, byOrg, byPos] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(c.montant_collecte), 0)::float AS encaisse, COALESCE(SUM(c.montant_attendu), 0)::float AS attendu,
              COALESCE(SUM(c.commission), 0)::float AS commissions, COUNT(*)::int AS collectes,
              (${from})::timestamptz AS du, (${to})::timestamptz AS au
         FROM collections c WHERE ${where}`,
      [orgId]
    ),
    query(
      `SELECT o.name AS organisation, COALESCE(SUM(c.montant_collecte), 0)::float AS encaisse, COUNT(*)::int AS collectes
         FROM collections c JOIN organizations o ON o.id = COALESCE(c.organization_id, c.organisation_id)
        WHERE ${where} GROUP BY o.name ORDER BY 2 DESC LIMIT 10`,
      [orgId]
    ),
    query(
      `SELECT pos.nom AS point_de_vente, o.name AS organisation, COALESCE(SUM(c.montant_collecte), 0)::float AS encaisse, COUNT(*)::int AS collectes
         FROM collections c JOIN points_of_sale pos ON pos.id = c.pos_id
         LEFT JOIN organizations o ON o.id = pos.organization_id
        WHERE ${where} GROUP BY pos.nom, o.name ORDER BY 3 DESC LIMIT 10`,
      [orgId]
    ),
  ]);
  return { periode: period, devise: 'FCFA', totaux: totals.rows[0], par_organisation: byOrg.rows, meilleurs_points_de_vente: byPos.rows };
}

export async function searchUsers(args: { query: string }) {
  const q = (args.query || '').trim();
  if (q.length < 2) return { error: 'Recherche trop courte (2 caractères minimum).' };
  const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
  const { rows } = await query(
    `SELECT p.nom, p.email, p.role, p.telephone, (p.is_active IS NOT FALSE AND p.deleted_at IS NULL) AS actif,
            o.name AS organisation, u.last_sign_in_at AS derniere_connexion, p.created_at
       FROM profiles p LEFT JOIN organizations o ON o.id = p.organization_id LEFT JOIN users u ON u.id = p.id
      WHERE p.nom ILIKE $1 OR p.email ILIKE $1 OR p.telephone ILIKE $1
      ORDER BY p.created_at DESC LIMIT 20`,
    [like]
  );
  return { total: rows.length, utilisateurs: rows };
}

export async function listPlans() {
  const { rows } = await query(
    `SELECT id AS plan_id, name AS forfait, price AS prix, currency AS devise, billing_period AS periode, trial_days AS jours_essai,
            max_users, max_points_of_sale, max_tickets_per_month, status
       FROM subscription_plans ORDER BY price`
  );
  return { forfaits: rows };
}

export async function getRecentActivity(args: { limit?: number }) {
  const limit = Math.min(30, Math.max(1, Number(args.limit) || 15));
  const { rows } = await query(
    `SELECT l.created_at, l.action, o.name AS organisation, pu.full_name AS par, l.new_data
       FROM platform_audit_logs l
       LEFT JOIN organizations o ON o.id = l.organization_id
       LEFT JOIN platform_users pu ON pu.id = l.platform_user_id
      ORDER BY l.created_at DESC LIMIT $1`,
    [limit]
  );
  return { actions_recentes_du_back_office: rows };
}

async function vercelDeployments(target: 'production' | 'preview') {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) return { erreur: 'VERCEL_TOKEN non configuré' };
  try {
    const url = `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&teamId=${VERCEL_TEAM_ID}&target=${target}&limit=3`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { erreur: `Vercel a refusé la requête (${res.status}${data?.error?.message ? ` : ${data.error.message}` : ''}). Le jeton VERCEL_TOKEN est probablement expiré ou sans accès à l'équipe : à régénérer.` };
    }
    type Deployment = { readyState?: string; state?: string; createdAt?: number; created?: number; source?: string; url: string; meta?: Record<string, string> };
    return ((data.deployments || []) as Deployment[]).map((d) => ({
      etat: d.readyState || d.state,
      date: new Date(d.createdAt || d.created || 0).toISOString(),
      branche: d.meta?.githubCommitRef,
      commit: d.meta?.githubCommitSha?.slice(0, 7),
      message: d.meta?.githubCommitMessage?.split('\n')[0],
      source: d.source,
      url: `https://${d.url}`,
    }));
  } catch {
    return { erreur: 'Vercel injoignable' };
  }
}

export async function getTechnicalStatus() {
  const started = Date.now();
  let db: Record<string, unknown>;
  try {
    const { rows } = await query(`SELECT NOW() AS now, (SELECT COUNT(*) FROM push_subscriptions)::int AS abonnements_push,
                                         (SELECT COUNT(*) FROM notifications WHERE created_at > NOW() - interval '24 hours')::int AS notifications_24h`);
    db = { ok: true, latence_ms: Date.now() - started, ...rows[0] };
  } catch {
    db = { ok: false, erreur: 'Base de données injoignable' };
  }
  const [production, preview] = await Promise.all([vercelDeployments('production'), vercelDeployments('preview')]);
  return {
    // Version qui exécute ce bot (variables système Vercel, toujours disponibles)
    version_en_cours: {
      environnement: process.env.VERCEL_ENV || 'local',
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
      message: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split('\n')[0],
      branche: process.env.VERCEL_GIT_COMMIT_REF,
      region: process.env.VERCEL_REGION,
    },
    base_de_donnees: db,
    deploiements_production: production,
    deploiements_preview: preview,
    site: 'https://www.optiwifi.site',
    taches_planifiees: ['contrôle de santé 9 h UTC', 'rappels de licence 8 h UTC'],
  };
}
