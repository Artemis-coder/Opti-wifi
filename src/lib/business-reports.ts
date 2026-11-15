// ============================================================
// OPTIWIFI - Rapports business envoyés au super admin sur Telegram (cron quotidien, sans IA) :
// rapport du matin, anomalies d'encaissement, clients à risque (lundi), bilan de la semaine (lundi).
// Mêmes règles de calcul que l'assistant du bot (src/lib/bot/admin-data.ts).
// ============================================================
import { query } from '@/lib/neon/db';
import { escapeTelegramHtml } from '@/lib/telegram';

const e = escapeTelegramHtml;
const LIVE_LICENCE = `s.status IN ('active', 'trialing') AND (s.end_date IS NULL OR s.end_date > NOW())`;
const COLLECTED_AT = `COALESCE(c.date_collecte, c.created_at)`;
const ORG_OF = `COALESCE(c.organization_id, c.organisation_id)`;

const fcfa = (n: number | string | null) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/ /g, ' ')} FCFA`;
const day = (d: string | Date) => new Date(d).toLocaleDateString('fr-FR', { timeZone: 'Africa/Abidjan', day: '2-digit', month: '2-digit', year: 'numeric' });
function trend(now: number, before: number): string {
  if (!before) return now ? ' (nouveau)' : '';
  const pct = Math.round(((now - before) / before) * 100);
  return pct === 0 ? ' (stable)' : ` (${pct > 0 ? '▲ +' : '▼ '}${pct} %)`;
}

// Seuils des alertes
const GAP_MIN_FCFA = 5000; // écart attendu / collecté signalé au-delà
const GAP_MIN_RATIO = 0.1; // et au-delà de 10 % de l'attendu
const DROP_RATIO = 0.5; // baisse brutale : semaine < 50 % de la moyenne des 4 semaines précédentes
const DROP_MIN_BASELINE = 20000; // ignorée pour les petits points de vente
const RISK_DAYS = 14; // client à risque : rien depuis 14 jours

/** 🌅 Rapport du matin : la journée d'hier et ce qui attend une action. */
export async function morningReport(): Promise<string> {
  const [money, byOrg, signups, requests, pendingOrgs, expiring] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(c.montant_collecte) FILTER (WHERE ${COLLECTED_AT} >= date_trunc('day', NOW()) - interval '1 day'), 0)::float AS hier,
              COALESCE(SUM(c.montant_attendu) FILTER (WHERE ${COLLECTED_AT} >= date_trunc('day', NOW()) - interval '1 day'), 0)::float AS attendu,
              COUNT(*) FILTER (WHERE ${COLLECTED_AT} >= date_trunc('day', NOW()) - interval '1 day')::int AS collectes,
              COALESCE(SUM(c.montant_collecte) FILTER (WHERE ${COLLECTED_AT} >= date_trunc('day', NOW()) - interval '8 days'
                                                       AND ${COLLECTED_AT} < date_trunc('day', NOW()) - interval '7 days'), 0)::float AS meme_jour_semaine_passee,
              COALESCE(SUM(c.montant_collecte) FILTER (WHERE ${COLLECTED_AT} >= date_trunc('month', NOW() - interval '1 day')), 0)::float AS mois
         FROM collections c
        WHERE ${COLLECTED_AT} >= LEAST(date_trunc('month', NOW() - interval '1 day'), date_trunc('day', NOW()) - interval '8 days')
          AND ${COLLECTED_AT} < date_trunc('day', NOW())`,
    ),
    query(
      `SELECT o.name, SUM(c.montant_collecte)::float AS total, COUNT(*)::int AS n
         FROM collections c JOIN organizations o ON o.id = ${ORG_OF}
        WHERE ${COLLECTED_AT} >= date_trunc('day', NOW()) - interval '1 day' AND ${COLLECTED_AT} < date_trunc('day', NOW())
        GROUP BY o.name ORDER BY 2 DESC LIMIT 5`,
    ),
    query(`SELECT name, status FROM organizations WHERE created_at >= NOW() - interval '24 hours' ORDER BY created_at DESC LIMIT 10`),
    query(
      `SELECT o.name, p.name AS plan, r.duration_months FROM license_requests r JOIN organizations o ON o.id = r.organization_id
         LEFT JOIN subscription_plans p ON p.id = r.plan_id WHERE r.status = 'pending' ORDER BY r.created_at LIMIT 10`,
    ),
    query(`SELECT COUNT(*)::int AS n FROM organizations WHERE status = 'pending_approval'`),
    query(
      `SELECT o.name, s.end_date FROM subscriptions s JOIN organizations o ON o.id = s.organization_id
        WHERE ${LIVE_LICENCE} AND s.end_date < NOW() + interval '7 days'
          AND NOT EXISTS (SELECT 1 FROM subscriptions s2 WHERE s2.organization_id = s.organization_id AND s2.id <> s.id
                            AND s2.status IN ('active', 'trialing') AND s2.end_date > s.end_date)
        ORDER BY s.end_date LIMIT 10`,
    ),
  ]);
  const m = money.rows[0] as { hier: number; attendu: number; collectes: number; meme_jour_semaine_passee: number; mois: number };
  const yesterday = new Date(Date.now() - 86400000);
  const lines = [`🌅 <b>Rapport du matin</b> — ${yesterday.toLocaleDateString('fr-FR', { timeZone: 'Africa/Abidjan', weekday: 'long', day: 'numeric', month: 'long' })}`, ''];

  lines.push(`💰 <b>Encaissé hier : ${fcfa(m.hier)}</b>${trend(m.hier, m.meme_jour_semaine_passee)}`);
  lines.push(`   ${m.collectes} collecte(s)${m.attendu ? `, attendu ${fcfa(m.attendu)}` : ''} · depuis le début du mois : ${fcfa(m.mois)}`);
  for (const r of byOrg.rows as { name: string; total: number; n: number }[]) lines.push(`   • ${e(r.name)} : ${fcfa(r.total)} (${r.n})`);

  const todo: string[] = [];
  if (requests.rows.length) {
    todo.push(`🧾 <b>${requests.rows.length} demande(s) de licence en attente</b>`);
    for (const r of requests.rows as { name: string; plan: string | null; duration_months: number | null }[]) {
      todo.push(`   • ${e(r.name)} — ${e(r.plan || 'forfait non précisé')}${r.duration_months ? `, ${r.duration_months} mois` : ''}`);
    }
  }
  const pending = (pendingOrgs.rows[0] as { n: number }).n;
  if (pending) todo.push(`🆕 <b>${pending} inscription(s) à valider</b>`);
  if (expiring.rows.length) {
    todo.push(`⏳ <b>${expiring.rows.length} licence(s) expirent sous 7 jours</b>`);
    for (const r of expiring.rows as { name: string; end_date: string }[]) todo.push(`   • ${e(r.name)} — le ${day(r.end_date)}`);
  }
  lines.push('', ...(todo.length ? ['👉 <b>À traiter</b>', ...todo] : ['✅ Rien en attente : aucune demande, inscription ou licence à relancer.']));

  if (signups.rows.length) {
    lines.push('', `🎉 <b>${signups.rows.length} nouvelle(s) inscription(s)</b> en 24 h : ${(signups.rows as { name: string }[]).map((r) => e(r.name)).join(', ')}`);
  }
  return lines.join('\n');
}

/** 💸 Anomalies d'encaissement : écarts d'hier et baisses brutales sur 7 jours. Null si rien à signaler. */
export async function collectionAnomalies(): Promise<string | null> {
  const [gaps, drops] = await Promise.all([
    query(
      `SELECT pos.nom AS pos, o.name AS org, SUM(c.montant_attendu)::float AS attendu, SUM(c.montant_collecte)::float AS collecte
         FROM collections c JOIN points_of_sale pos ON pos.id = c.pos_id LEFT JOIN organizations o ON o.id = pos.organization_id
        WHERE ${COLLECTED_AT} >= date_trunc('day', NOW()) - interval '1 day' AND ${COLLECTED_AT} < date_trunc('day', NOW())
        GROUP BY pos.nom, o.name
       HAVING ABS(SUM(c.montant_attendu) - SUM(c.montant_collecte)) >= $1
          AND ABS(SUM(c.montant_attendu) - SUM(c.montant_collecte)) >= $2 * GREATEST(SUM(c.montant_attendu), 1)
        ORDER BY ABS(SUM(c.montant_attendu) - SUM(c.montant_collecte)) DESC LIMIT 10`,
      [GAP_MIN_FCFA, GAP_MIN_RATIO],
    ),
    query(
      `SELECT pos.nom AS pos, o.name AS org,
              COALESCE(SUM(c.montant_collecte) FILTER (WHERE ${COLLECTED_AT} >= date_trunc('day', NOW()) - interval '7 days'), 0)::float AS semaine,
              (COALESCE(SUM(c.montant_collecte) FILTER (WHERE ${COLLECTED_AT} < date_trunc('day', NOW()) - interval '7 days'), 0) / 4)::float AS moyenne
         FROM points_of_sale pos JOIN collections c ON c.pos_id = pos.id LEFT JOIN organizations o ON o.id = pos.organization_id
        WHERE ${COLLECTED_AT} >= date_trunc('day', NOW()) - interval '35 days' AND ${COLLECTED_AT} < date_trunc('day', NOW())
        GROUP BY pos.nom, o.name
       HAVING COALESCE(SUM(c.montant_collecte) FILTER (WHERE ${COLLECTED_AT} < date_trunc('day', NOW()) - interval '7 days'), 0) / 4 >= $1
          AND COALESCE(SUM(c.montant_collecte) FILTER (WHERE ${COLLECTED_AT} >= date_trunc('day', NOW()) - interval '7 days'), 0)
              < $2 * COALESCE(SUM(c.montant_collecte) FILTER (WHERE ${COLLECTED_AT} < date_trunc('day', NOW()) - interval '7 days'), 0) / 4
        ORDER BY 4 DESC LIMIT 10`,
      [DROP_MIN_BASELINE, DROP_RATIO],
    ),
  ]);
  if (!gaps.rows.length && !drops.rows.length) return null;
  const lines = ['💸 <b>Anomalies d’encaissement</b>', ''];
  if (gaps.rows.length) {
    lines.push(`⚖️ <b>Écarts d’hier entre attendu et collecté</b> (plus de ${fcfa(GAP_MIN_FCFA)} et de ${GAP_MIN_RATIO * 100} %)`);
    for (const r of gaps.rows as { pos: string; org: string | null; attendu: number; collecte: number }[]) {
      const diff = r.collecte - r.attendu;
      lines.push(`   • ${e(r.pos)}${r.org ? ` (${e(r.org)})` : ''} : attendu ${fcfa(r.attendu)}, collecté ${fcfa(r.collecte)} → <b>${diff > 0 ? '+' : ''}${fcfa(diff)}</b>`);
    }
  }
  if (drops.rows.length) {
    if (gaps.rows.length) lines.push('');
    lines.push(`📉 <b>Baisses brutales sur 7 jours</b> (moins de la moitié de la moyenne des 4 semaines précédentes)`);
    for (const r of drops.rows as { pos: string; org: string | null; semaine: number; moyenne: number }[]) {
      lines.push(`   • ${e(r.pos)}${r.org ? ` (${e(r.org)})` : ''} : ${fcfa(r.semaine)} cette semaine contre ${fcfa(r.moyenne)} en moyenne`);
    }
  }
  lines.push('', '👉 Vérifiez avec le point de vente ou le collecteur concerné.');
  return lines.join('\n');
}

/** 📉 Clients à risque : licence active mais aucune collecte ni connexion depuis 14 jours. Null si aucun. */
export async function riskClients(): Promise<string | null> {
  const { rows } = await query(
    `SELECT o.name, o.contact_name, o.phone, s.end_date,
            (SELECT MAX(${COLLECTED_AT}) FROM collections c WHERE ${ORG_OF} = o.id) AS derniere_collecte,
            (SELECT MAX(u.last_sign_in_at) FROM profiles p JOIN users u ON u.id = p.id WHERE p.organization_id = o.id) AS derniere_connexion
       FROM organizations o JOIN subscriptions s ON s.organization_id = o.id AND ${LIVE_LICENCE}
      WHERE o.status NOT IN ('suspended', 'archived', 'cancelled', 'pending_approval')
      GROUP BY o.id, o.name, o.contact_name, o.phone, s.end_date`,
  );
  const limit = Date.now() - RISK_DAYS * 86400000;
  const atRisk = (rows as { name: string; contact_name: string | null; phone: string | null; end_date: string | null; derniere_collecte: string | null; derniere_connexion: string | null }[])
    .filter((r) => (!r.derniere_collecte || +new Date(r.derniere_collecte) < limit) && (!r.derniere_connexion || +new Date(r.derniere_connexion) < limit))
    .slice(0, 15);
  if (!atRisk.length) return null;
  const since = (d: string | null) => (d ? `le ${day(d)}` : 'jamais');
  const lines = [`📉 <b>${atRisk.length} client(s) à risque</b> — licence active mais aucune activité depuis ${RISK_DAYS} jours`, ''];
  for (const r of atRisk) {
    lines.push(`• <b>${e(r.name)}</b>${r.contact_name ? ` — ${e(r.contact_name)}` : ''}${r.phone ? ` (${e(r.phone)})` : ''}`);
    lines.push(`   dernière collecte ${since(r.derniere_collecte)}, dernière connexion ${since(r.derniere_connexion)}${r.end_date ? `, licence jusqu’au ${day(r.end_date)}` : ''}`);
  }
  lines.push('', '👉 Un appel ou un message permet souvent de débloquer une installation ou une formation.');
  return lines.join('\n');
}

/** 📊 Bilan de la semaine écoulée (lundi → dimanche) comparé à la précédente. */
export async function weeklyReport(): Promise<string> {
  const W = `date_trunc('week', NOW())`;
  const [money, top, signups, sold] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(c.montant_collecte) FILTER (WHERE ${COLLECTED_AT} >= ${W} - interval '7 days'), 0)::float AS semaine,
              COALESCE(SUM(c.montant_collecte) FILTER (WHERE ${COLLECTED_AT} < ${W} - interval '7 days'), 0)::float AS precedente,
              COUNT(*) FILTER (WHERE ${COLLECTED_AT} >= ${W} - interval '7 days')::int AS collectes,
              COALESCE(SUM(c.commission) FILTER (WHERE ${COLLECTED_AT} >= ${W} - interval '7 days'), 0)::float AS commissions,
              (${W} - interval '7 days') AS du, (${W} - interval '1 day') AS au
         FROM collections c WHERE ${COLLECTED_AT} >= ${W} - interval '14 days' AND ${COLLECTED_AT} < ${W}`,
    ),
    query(
      `SELECT o.name, SUM(c.montant_collecte)::float AS total FROM collections c JOIN organizations o ON o.id = ${ORG_OF}
        WHERE ${COLLECTED_AT} >= ${W} - interval '7 days' AND ${COLLECTED_AT} < ${W} GROUP BY o.name ORDER BY 2 DESC LIMIT 5`,
    ),
    query(
      `SELECT COUNT(*) FILTER (WHERE created_at >= ${W} - interval '7 days')::int AS semaine,
              COUNT(*) FILTER (WHERE created_at < ${W} - interval '7 days')::int AS precedente
         FROM organizations WHERE created_at >= ${W} - interval '14 days' AND created_at < ${W}`,
    ),
    query(
      `SELECT COALESCE(p.name, 'Sans forfait') AS plan, COUNT(*)::int AS n, COALESCE(SUM(p.price), 0)::float AS valeur
         FROM subscriptions s LEFT JOIN subscription_plans p ON p.id = s.plan_id
        WHERE s.created_at >= ${W} - interval '7 days' AND s.created_at < ${W} AND s.trial_end IS NULL
        GROUP BY 1 ORDER BY 2 DESC`,
    ),
  ]);
  const m = money.rows[0] as { semaine: number; precedente: number; collectes: number; commissions: number; du: string; au: string };
  const s = signups.rows[0] as { semaine: number; precedente: number };
  const lines = [`📊 <b>Bilan de la semaine</b> — du ${day(m.du)} au ${day(m.au)}`, ''];
  lines.push(`💰 <b>Encaissé : ${fcfa(m.semaine)}</b>${trend(m.semaine, m.precedente)}`);
  lines.push(`   ${m.collectes} collecte(s)${m.commissions ? ` · commissions ${fcfa(m.commissions)}` : ''} · semaine précédente ${fcfa(m.precedente)}`);
  if (top.rows.length) {
    lines.push('', '🏆 <b>Meilleurs clients</b>');
    (top.rows as { name: string; total: number }[]).forEach((r, i) => lines.push(`   ${i + 1}. ${e(r.name)} — ${fcfa(r.total)}`));
  }
  lines.push('', `🎉 <b>Inscriptions : ${s.semaine}</b>${trend(s.semaine, s.precedente)}`);
  if (sold.rows.length) {
    lines.push('', '🧾 <b>Licences vendues</b>');
    for (const r of sold.rows as { plan: string; n: number; valeur: number }[]) lines.push(`   • ${e(r.plan)} : ${r.n}${r.valeur ? ` (${fcfa(r.valeur)})` : ''}`);
  } else {
    lines.push('', '🧾 Aucune licence payante vendue cette semaine.');
  }
  return lines.join('\n');
}
