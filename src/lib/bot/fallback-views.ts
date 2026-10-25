// ============================================================
// OPTIWIFI - Affichages du bot sans IA : quand aucun modèle ne répond, les boutons du menu
// affichent directement les données (mise en forme fixe, HTML Telegram).
// ============================================================
import {
  getPlatformOverview,
  getRevenueReport,
  getTechnicalStatus,
  listExpiringLicences,
  listLicenseRequests,
  listOrganizations,
} from '@/lib/bot/admin-data';

type Row = Record<string, unknown>;

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
const money = (v: unknown) => `${Number(v || 0).toLocaleString('fr-FR')} FCFA`;
const date = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString('fr-FR', { timeZone: 'Africa/Abidjan' }) : '—');
const dateTime = (v: unknown) =>
  v ? new Date(String(v)).toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan', dateStyle: 'short', timeStyle: 'short' }) : '—';

const STATUS_FR: Record<string, string> = {
  active: 'actif',
  trial: 'essai',
  expiring: 'expire bientôt',
  expired: 'expiré',
  suspended: 'suspendu',
  cancelled: 'refusé',
  archived: 'supprimé',
  pending_approval: 'à valider',
  pending: 'en attente',
  approved: 'approuvée',
  rejected: 'refusée',
};
const fr = (s: unknown) => STATUS_FR[String(s)] || esc(s);

async function overview(): Promise<string> {
  const o = await getPlatformOverview();
  const l = o.licences as Row;
  const e = o.encaissements as Row;
  const a = o.activite as Row;
  return [
    '📊 <b>Vue d’ensemble</b>',
    '',
    `🏢 <b>Organisations :</b> ${(o.organisations_par_statut as Row[]).map((r) => `${r.n} ${fr(r.status)}`).join(', ') || 'aucune'}`,
    `🧾 <b>Demandes de licence :</b> ${(o.demandes_de_licence_par_statut as Row[]).map((r) => `${r.n} ${fr(r.status)}`).join(', ') || 'aucune'}`,
    `🔑 <b>Licences actives :</b> ${l.organisations_avec_licence_active} · expirent sous 7 j : ${l.expirent_sous_7_jours} · sous 30 j : ${l.expirent_sous_30_jours}`,
    `💰 <b>Encaissé ce mois :</b> ${money(e.encaisse_ce_mois)} (${e.collectes_ce_mois} collectes) · mois dernier : ${money(e.encaisse_mois_dernier)}`,
    `👥 <b>Utilisateurs actifs :</b> ${a.utilisateurs_actifs} · points de vente : ${a.points_de_vente} · espaces WiFi : ${a.espaces_wifi}`,
    '',
    '🆕 <b>Dernières inscriptions</b>',
    ...(o.dernieres_inscriptions as Row[]).map((r) => `• ${esc(r.name)} — ${fr(r.status)} — ${date(r.created_at)}`),
  ].join('\n');
}

async function pendingRequests(): Promise<string> {
  const r = await listLicenseRequests({ status: 'pending' });
  if (r.demandes.length === 0) return '🧾 <b>Demandes en attente</b>\n\nAucune demande de licence en attente. ✅';
  return [
    `🧾 <b>Demandes en attente (${r.total})</b>`,
    ...(r.demandes as Row[]).map(
      (d) =>
        `\n• <b>${esc(d.organisation)}</b> — ${esc(d.forfait_demande || '—')} pour ${d.duration_months || '?'} mois` +
        `${d.prix ? ` (${money(d.prix)})` : ''}\n  Demandée le ${date(d.created_at)}${d.demande_par ? ` par ${esc(d.demande_par)}` : ''}` +
        `${d.forfait_actuel ? `\n  Actuel : ${esc(d.forfait_actuel)} jusqu’au ${date(d.fin_licence_actuelle)}` : ''}` +
        `${d.message ? `\n  Message : <i>${esc(d.message)}</i>` : ''}`
    ),
  ].join('\n');
}

async function clients(): Promise<string> {
  const r = await listOrganizations({ limit: 30 });
  if (r.organisations.length === 0) return '🏢 <b>Clients</b>\n\nAucun client.';
  return [
    `🏢 <b>Clients (${r.total})</b>`,
    ...(r.organisations as Row[]).map(
      (o) =>
        `\n• <b>${esc(o.name)}</b> — ${fr(o.status)}\n  ${o.forfait ? `${esc(o.forfait)} jusqu’au ${date(o.fin_licence)}${o.licence_active ? '' : ' (expirée)'}` : 'aucune licence'}` +
        ` · ${o.utilisateurs} utilisateur(s) · ${o.points_de_vente} point(s) de vente` +
        `${o.derniere_collecte ? ` · dernière collecte ${date(o.derniere_collecte)}` : ''}`
    ),
  ].join('\n');
}

async function expiring(): Promise<string> {
  const r = await listExpiringLicences({ days: 30 });
  const soon = r.expirent_bientot as Row[];
  const done = r.deja_expirees_sans_renouvellement as Row[];
  return [
    '⏳ <b>Licences à renouveler</b>',
    '',
    `<b>Expirent sous 30 jours :</b>${soon.length ? '' : ' aucune ✅'}`,
    ...soon.map((s) => `• ${esc(s.organisation)} — ${esc(s.forfait)} — le ${date(s.fin)} (${s.jours_restants} j)${s.phone ? ` · ${esc(s.phone)}` : ''}`),
    '',
    `<b>Déjà expirées :</b>${done.length ? '' : ' aucune ✅'}`,
    ...done.map((s) => `• ${esc(s.organisation)} — ${esc(s.dernier_forfait)} — depuis le ${date(s.expiree_le)}${s.phone ? ` · ${esc(s.phone)}` : ''}`),
  ].join('\n');
}

async function revenue(): Promise<string> {
  const r = await getRevenueReport({ period: 'month' });
  if ('ok' in r && r.ok === false) return `❌ ${esc(r.error)}`;
  const report = r as Exclude<typeof r, { ok: false }>;
  const t = report.totaux as Row;
  return [
    '💰 <b>Encaissements du mois</b>',
    '',
    `Encaissé : <b>${money(t.encaisse)}</b> sur ${money(t.attendu)} attendus · ${t.collectes} collecte(s) · commissions ${money(t.commissions)}`,
    '',
    '<b>Par client</b>',
    ...((report.par_organisation as Row[]).map((o) => `• ${esc(o.organisation)} : ${money(o.encaisse)} (${o.collectes})`) || []),
    '',
    '<b>Meilleurs points de vente</b>',
    ...(report.meilleurs_points_de_vente as Row[]).map((p) => `• ${esc(p.point_de_vente)} (${esc(p.organisation)}) : ${money(p.encaisse)}`),
  ].join('\n');
}

export async function technicalStatusView(): Promise<string> {
  const status = await getTechnicalStatus();
  const deployments = (list: unknown) =>
    Array.isArray(list)
      ? list
          .map((d: Row) => `• ${d.etat === 'READY' ? '✅' : d.etat === 'ERROR' ? '❌' : '🔄'} ${dateTime(d.date)} — ${esc(d.message || d.commit)} <code>${esc(d.commit)}</code>`)
          .join('\n') || '• aucun'
      : `• ⚠️ ${esc((list as { erreur?: string })?.erreur || 'indisponible')}`;
  const v = status.version_en_cours;
  const db = status.base_de_donnees as { ok?: boolean; latence_ms?: number };
  return [
    '🖥️ <b>Statut technique</b>',
    '',
    '🌐 https://www.optiwifi.site',
    `🏷️ <b>Version en cours :</b> ${esc(v.environnement)} · <code>${esc(v.commit || '—')}</code> ${esc(v.message || '')}`,
    `🗄️ <b>Base de données :</b> ${db.ok ? `✅ OK (${db.latence_ms} ms)` : '❌ injoignable'}`,
    '',
    '🚀 <b>Production</b>',
    deployments(status.deploiements_production),
    '',
    '🧪 <b>Preview (develop)</b>',
    deployments(status.deploiements_preview),
  ].join('\n');
}

/** Bouton du menu → affichage direct des données (null si ce n'est pas un bouton connu). */
export const MENU_VIEWS: Record<string, () => Promise<string>> = {
  '📊 Vue d’ensemble': overview,
  '🧾 Demandes en attente': pendingRequests,
  '🏢 Clients': clients,
  '⏳ Licences à renouveler': expiring,
  '💰 Encaissements du mois': revenue,
  '🖥️ Statut technique': technicalStatusView,
  '📊 Statut Projet': technicalStatusView,
};
