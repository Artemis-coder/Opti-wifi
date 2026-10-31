// Présentation lisible du journal d'audit du back-office (aucun import serveur : utilisé côté navigateur).

export type AuditTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const AUDIT_ACTIONS: Record<string, { label: string; tone: AuditTone }> = {
  license_activated: { label: 'Licence activée', tone: 'success' },
  license_request_rejected: { label: 'Demande de licence refusée', tone: 'danger' },
  'organization.approve': { label: 'Inscription validée', tone: 'success' },
  'organization.activate': { label: 'Client activé', tone: 'success' },
  'organization.reactivate': { label: 'Client réactivé', tone: 'success' },
  'organization.suspend': { label: 'Client suspendu', tone: 'warning' },
  'organization.cancel': { label: 'Inscription refusée', tone: 'danger' },
  'organization.archive': { label: 'Client supprimé', tone: 'danger' },
  'user.create': { label: 'Utilisateur créé', tone: 'success' },
  'user.suspend': { label: 'Utilisateur désactivé', tone: 'warning' },
  'user.reactivate': { label: 'Utilisateur réactivé', tone: 'success' },
  'user.delete': { label: 'Utilisateur supprimé', tone: 'danger' },
  'user.change_role': { label: 'Rôle modifié', tone: 'info' },
  'user.reset_password': { label: 'Mot de passe réinitialisé', tone: 'info' },
  'plan.create': { label: 'Forfait créé', tone: 'success' },
  'plan.update': { label: 'Forfait modifié', tone: 'info' },
  'plan.delete': { label: 'Forfait supprimé', tone: 'danger' },
  payment_method_created: { label: 'Moyen de paiement ajouté', tone: 'success' },
  payment_method_updated: { label: 'Moyen de paiement modifié', tone: 'info' },
  payment_method_deleted: { label: 'Moyen de paiement supprimé', tone: 'danger' },
  'platform_settings.update': { label: 'Paramètre modifié', tone: 'info' },
  'site_content.update': { label: 'Site vitrine modifié', tone: 'info' },
  'telegram_config.update': { label: 'Bot Telegram configuré', tone: 'info' },
  'telegram_config.reset': { label: 'Réglage du bot rétabli (Vercel)', tone: 'neutral' },
  'subscription.cancel': { label: 'Abonnement annulé', tone: 'danger' },
  'subscription.reactivate': { label: 'Abonnement réactivé', tone: 'success' },
  'subscription.suspend': { label: 'Abonnement suspendu', tone: 'warning' },
  impersonate_access: { label: 'Accès support', tone: 'warning' },
};

/** Libellé d'une action inconnue : « payment_method_created » → « Payment method created » */
export function auditActionInfo(action: string): { label: string; tone: AuditTone } {
  if (AUDIT_ACTIONS[action]) return AUDIT_ACTIONS[action];
  const text = action.replace(/[._]+/g, ' ').trim();
  return { label: text.charAt(0).toUpperCase() + text.slice(1), tone: 'neutral' };
}

/** Catégories du filtre (type d'élément concerné) */
export const AUDIT_CATEGORIES: { value: string; label: string }[] = [
  { value: '', label: 'Toutes les actions' },
  { value: 'subscription', label: 'Licences' },
  { value: 'license_request', label: 'Demandes de licence' },
  { value: 'organization', label: 'Clients' },
  { value: 'user', label: 'Utilisateurs' },
  { value: 'subscription_plan', label: 'Forfaits' },
  { value: 'payment_method', label: 'Moyens de paiement' },
  { value: 'platform_settings', label: 'Paramètres' },
  { value: 'site_content', label: 'Site vitrine' },
];

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  subscription: 'Licence',
  license_request: 'Demande de licence',
  organization: 'Client',
  user: 'Utilisateur',
  subscription_plan: 'Forfait',
  payment_method: 'Moyen de paiement',
  platform_settings: 'Paramètre',
  site_content: 'Site vitrine',
};

const SETTING_LABELS: Record<string, string> = {
  support_email: 'E-mail du support',
  support_phone: 'Téléphone du support',
  platform_name: 'Nom de la plateforme',
  platform_logo: 'Logo de la plateforme',
  platform_currency: 'Devise',
  trial_days: "Durée d'essai (jours)",
  grace_period_days: 'Délai de grâce (jours)',
  notification_before_expiry: 'Rappel avant expiration (jours)',
  notification_after_expiry: 'Rappel après expiration (jours)',
  auto_renew_default: 'Renouvellement automatique par défaut',
  max_login_attempts: 'Tentatives de connexion max.',
  session_timeout_minutes: 'Expiration de session (min)',
  maintenance_mode: 'Mode maintenance',
  maintenance_message: 'Message de maintenance',
  allow_registration: 'Inscriptions ouvertes',
};

export function settingLabel(key: string): string {
  return SETTING_LABELS[key] || key;
}

const FIELD_LABELS: Record<string, string> = {
  status: 'Statut',
  organization_status: 'Statut du client',
  reason: 'Motif',
  note: 'Note',
  plan_name: 'Forfait',
  duration_months: 'Durée',
  start_date: 'Début',
  end_date: 'Fin',
  name: 'Nom',
  description: 'Description',
  price: 'Prix',
  currency: 'Devise',
  billing_period: 'Facturation',
  trial_days: "Jours d'essai",
  max_users: 'Utilisateurs max.',
  max_points_of_sale: 'Points de vente max.',
  max_collectors: 'Collecteurs max.',
  max_tickets_per_month: 'Tickets / mois max.',
  features: 'Fonctionnalités',
  is_active: 'Actif',
  deleted: 'Supprimé',
  role: 'Rôle',
  account_number: 'Numéro de paiement',
  account_name: 'Titulaire',
  whatsapp_url: 'Lien WhatsApp',
  logo: 'QR code',
  brand_logo: "Logo de l'opérateur",
  brand_color: 'Couleur',
  sort_order: 'Ordre',
  value: 'Valeur',
  email: 'E-mail',
  full_name: 'Nom',
  nom: 'Nom',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  trial: 'Essai',
  trialing: 'Essai',
  expiring: 'Expire bientôt',
  expired: 'Expiré',
  suspended: 'Suspendu',
  cancelled: 'Refusé / annulé',
  archived: 'Supprimé',
  pending_approval: 'En attente de validation',
  inactive: 'Inactif',
  pending: 'En attente',
  approved: 'Approuvée',
  rejected: 'Refusée',
};

const PERIOD_LABELS: Record<string, string> = {
  monthly: 'Mensuelle',
  quarterly: 'Trimestrielle',
  semiannual: 'Semestrielle',
  annual: 'Annuelle',
};
const ROLE_LABELS: Record<string, string> = { administrateur: 'Administrateur', collecteur: 'Collecteur', super_admin: 'Super admin' };

// Champs techniques jamais affichés dans « Ce qui a changé »
const HIDDEN_FIELDS = new Set(['id', 'created_at', 'updated_at', 'organization_id']);
const isHidden = (key: string) => HIDDEN_FIELDS.has(key) || key.endsWith('_id');

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] || key.replace(/_/g, ' ');
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export function formatAuditValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '' || value === 'null') return '—';
  if (value === '[image]') return 'Image';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (key === 'status' || key === 'organization_status') return STATUS_LABELS[String(value)] || String(value);
  if (key === 'billing_period') return PERIOD_LABELS[String(value)] || String(value);
  if (key === 'role') return ROLE_LABELS[String(value)] || String(value);
  if (key === 'duration_months') return `${value} mois`;
  if (key === 'price' || key === 'amount') {
    const n = Number(value);
    return Number.isFinite(n) ? `${n.toLocaleString('fr-FR')} F CFA` : String(value);
  }
  if ((key.endsWith('_date') || key.endsWith('_at')) && typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return dateFmt.format(new Date(value));
  }
  if (Array.isArray(value)) return value.map((v) => formatAuditValue('', v)).join(', ') || '—';
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    // Ex. features : { wifi_spaces: true, advanced_stats: false } → « wifi spaces »
    if (entries.every(([, v]) => typeof v === 'boolean')) {
      return (
        entries
          .filter(([, v]) => v)
          .map(([k]) => k.replace(/_/g, ' '))
          .join(', ') || 'Aucune'
      );
    }
    return entries.map(([k, v]) => `${fieldLabel(k)} : ${formatAuditValue(k, v)}`).join(' · ');
  }
  return String(value);
}

// Ordre de lecture : l'essentiel d'abord, les commentaires à la fin
const FIELD_ORDER = [
  'name',
  'plan_name',
  'status',
  'organization_status',
  'role',
  'is_active',
  'value',
  'price',
  'billing_period',
  'duration_months',
  'start_date',
  'end_date',
  'trial_days',
  'max_users',
  'max_points_of_sale',
  'max_collectors',
  'max_tickets_per_month',
  'account_number',
  'account_name',
  'whatsapp_url',
  'logo',
  'brand_logo',
  'brand_color',
  'description',
  'features',
  'reason',
  'note',
];

export interface AuditChange {
  key: string;
  label: string;
  before: string | null;
  after: string | null;
}

const asObject = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/**
 * Champs modifiés, lisibles. Champ présent avant et après : affiché seulement s'il a changé
 * (« avant → après »). Champ présent d'un seul côté : sa valeur seule.
 */
export function auditChanges(oldData: unknown, newData: unknown, entityType?: string | null, entityId?: string | null): AuditChange[] {
  const before = asObject(oldData);
  const after = asObject(newData);
  const rank = (k: string) => {
    const i = FIELD_ORDER.indexOf(k);
    return i === -1 ? FIELD_ORDER.length : i;
  };
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]))
    .filter((k) => !isHidden(k))
    .sort((x, y) => rank(x) - rank(y));
  const changes: AuditChange[] = [];
  for (const key of keys) {
    const b = before && key in before ? before[key] : undefined;
    const a = after && key in after ? after[key] : undefined;
    if (before && after && JSON.stringify(b) === JSON.stringify(a)) continue;
    // Paramètre de la plateforme : le libellé est celui du paramètre (entity_id), pas « Valeur »
    const label = entityType === 'platform_settings' && key === 'value' && entityId ? settingLabel(entityId) : fieldLabel(key);
    const inBefore = !!before && key in before;
    const inAfter = !!after && key in after;
    changes.push({
      key,
      // Valeur connue seulement avant l'action (ex. statut du client avant activation)
      label: inBefore && !inAfter && after ? `${label} (avant)` : label,
      before: inBefore ? formatAuditValue(key, b) : null,
      after: inAfter ? formatAuditValue(key, a) : null,
    });
  }
  return changes;
}

/** Résumé d'une ligne du journal (liste) */
export function auditSummary(log: {
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  old_data?: unknown;
  new_data?: unknown;
}): string {
  const n = asObject(log.new_data) || {};
  const o = asObject(log.old_data) || {};
  switch (log.action) {
    case 'license_activated':
      return [n.plan_name, n.duration_months ? `${n.duration_months} mois` : null].filter(Boolean).join(' · ');
    case 'license_request_rejected':
      return n.note ? `Motif : ${n.note}` : '';
    case 'platform_settings.update':
      return log.entity_id ? `${settingLabel(log.entity_id)} : ${formatAuditValue('value', n.value)}` : '';
    default:
      if (log.action.startsWith('organization.')) return n.reason && n.reason !== 'Super admin action' ? `Motif : ${n.reason}` : '';
      return String(n.name || o.name || '');
  }
}
