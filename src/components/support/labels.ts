// Libellés du support, partagés client / back-office (aucun import serveur).

export const CATEGORY_OPTIONS = [
  { value: 'billing', label: 'Abonnement et paiement' },
  { value: 'technical', label: 'Problème technique' },
  { value: 'account', label: 'Compte et accès' },
  { value: 'other', label: 'Autre demande' },
];

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Basse' },
  { value: 'normal', label: 'Normale' },
  { value: 'high', label: 'Haute' },
];

export const STATUS_INFO: Record<string, { label: string; variant: 'info' | 'warning' | 'success' | 'neutral' }> = {
  new: { label: 'Nouveau', variant: 'info' },
  in_progress: { label: 'En cours', variant: 'warning' },
  resolved: { label: 'Résolu', variant: 'success' },
  closed: { label: 'Fermé', variant: 'neutral' },
};

export const STATUS_OPTIONS = Object.entries(STATUS_INFO).map(([value, s]) => ({ value, label: s.label }));

export const categoryLabel = (v: string) => CATEGORY_OPTIONS.find((c) => c.value === v)?.label || 'Autre demande';
export const priorityLabel = (v: string) => PRIORITY_OPTIONS.find((c) => c.value === v)?.label || 'Normale';

export function timeAgo(date: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  if (s < 60) return "à l'instant";
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'hier' : `il y a ${d} j`;
}

export interface TicketListItem {
  id: string;
  ticket_number: string;
  organization_id: string | null;
  organization_name: string | null;
  subject: string;
  category: string;
  priority: string;
  status: string;
  opened_by_support: boolean;
  created_at: string;
  last_message_at: string;
  messages_count: number;
  last_from_support: boolean | null;
}

export interface TicketMessage {
  id: string;
  author_name: string | null;
  from_support: boolean;
  body: string;
  created_at: string;
}
