// ============================================================
// OPTIWIFI - Notifications d'activité des espaces
// À chaque action sur les tickets et l'argent d'un point de vente, les personnes concernées
// sont prévenues (in-app + push sur tous leurs appareils) :
// - le compte du point de vente (son téléphone sonne : « Vous avez reçu 200 tickets… ») ;
// - le collecteur du point de vente ;
// - les administrateurs de l'espace.
// L'auteur de l'action n'est jamais notifié de sa propre action.
// À appeler via notifyInBackground (après la réponse, n'échoue jamais).
// ============================================================
import { query } from '@/lib/neon/db';
import { getOrganizationAdminIds, notifyUsers, type NotificationInput } from '@/lib/notifications';

type Row = Record<string, unknown>;

interface PosAudience {
  posName: string;
  posAccountIds: string[];
  collectorId: string | null;
}

const fcfa = (n: number) => `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} FCFA`;
const plural = (n: number, one: string, many: string) => `${new Intl.NumberFormat('fr-FR').format(n)} ${n > 1 ? many : one}`;

/** « a, b et c » */
function joinFr(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}`;
}

/** Point de vente : nom, accès « point de vente » actifs et collecteur attitré. */
async function posAudience(posId: string, organizationId: string): Promise<PosAudience | null> {
  const { rows } = await query(
    `SELECT s.nom, s.collecteur_id,
            COALESCE((SELECT array_agg(p.id) FROM profiles p
                       WHERE p.pos_id = s.id AND p.role = 'point_de_vente'
                         AND p.is_active IS NOT FALSE AND p.deleted_at IS NULL), '{}') AS accounts
       FROM points_of_sale s
      WHERE s.id = $1 AND s.organization_id = $2`,
    [posId, organizationId]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    posName: (r.nom as string) || 'point de vente',
    posAccountIds: (r.accounts as string[]) || [],
    collectorId: (r.collecteur_id as string | null) ?? null,
  };
}

async function actorName(actorId: string | null): Promise<string | null> {
  if (!actorId) return null;
  const { rows } = await query(`SELECT nom FROM profiles WHERE id = $1`, [actorId]);
  return (rows[0]?.nom as string | null) ?? null;
}

/** Envoie trois messages (point de vente, collecteur, administrateurs), sans jamais notifier l'auteur. */
async function dispatch(
  organizationId: string,
  actorId: string | null,
  audience: PosAudience,
  messages: { pos?: NotificationInput; collector?: NotificationInput; admins?: NotificationInput }
) {
  const notMe = (ids: (string | null)[]) => ids.filter((id): id is string => !!id && id !== actorId);
  const tasks: Promise<void>[] = [];
  const posIds = notMe(audience.posAccountIds);
  if (messages.pos && posIds.length) tasks.push(notifyUsers(posIds, messages.pos));
  const collector = notMe([audience.collectorId]);
  if (messages.collector && collector.length) tasks.push(notifyUsers(collector, messages.collector));
  if (messages.admins) {
    const admins = notMe(await getOrganizationAdminIds(organizationId)).filter((id) => !collector.includes(id));
    if (admins.length) tasks.push(notifyUsers(admins, messages.admins));
  }
  await Promise.all(tasks);
}

/** Libellés « 200 tickets Pass 1h et 50 tickets Pass 24h » par point de vente. */
async function ticketSummary(rows: { ticket_type_id: string; quantite: number }[], organizationId: string) {
  const ids = [...new Set(rows.map((r) => r.ticket_type_id))];
  const { rows: types } = await query(`SELECT id, nom FROM ticket_types WHERE id = ANY($1::uuid[]) AND organization_id = $2`, [
    ids,
    organizationId,
  ]);
  const names = new Map(types.map((t) => [t.id as string, (t.nom as string) || 'tickets']));
  const byType = new Map<string, number>();
  for (const r of rows) byType.set(r.ticket_type_id, (byType.get(r.ticket_type_id) || 0) + Number(r.quantite || 0));
  const total = [...byType.values()].reduce((a, b) => a + b, 0);
  const text = joinFr([...byType.entries()].map(([id, q]) => `${plural(q, 'ticket', 'tickets')} ${names.get(id) ?? ''}`.trim()));
  return { total, text };
}

/** Allocation de tickets (une ou plusieurs lignes, éventuellement sur plusieurs points de vente). */
export async function notifyAllocationsCreated(organizationId: string, actorId: string | null, inserted: Row[]) {
  const rows = inserted
    .filter((r) => r && r.pos_id && r.ticket_type_id && (!r.type || r.type === 'allocation') && Number(r.quantite) > 0)
    .map((r) => ({ pos_id: r.pos_id as string, ticket_type_id: r.ticket_type_id as string, quantite: Number(r.quantite) }));
  if (!rows.length) return;
  const who = await actorName(actorId);
  const byPos = new Map<string, typeof rows>();
  for (const r of rows) byPos.set(r.pos_id, [...(byPos.get(r.pos_id) || []), r]);

  for (const [posId, posRows] of byPos) {
    const audience = await posAudience(posId, organizationId);
    if (!audience) continue;
    const { total, text } = await ticketSummary(posRows, organizationId);
    await dispatch(organizationId, actorId, audience, {
      pos: {
        type: 'pos.tickets_received',
        title: 'Nouveaux tickets reçus',
        body: `Vous avez reçu ${text}.`,
        link: '/allocations',
        ring: true,
      },
      collector: {
        type: 'team.allocation_created',
        title: `Tickets attribués à ${audience.posName}`,
        body: `${text}${who ? `, par ${who}` : ''}.`,
        link: '/allocations',
      },
      admins: {
        type: 'team.allocation_created',
        title: `${plural(total, 'ticket attribué', 'tickets attribués')} à ${audience.posName}`,
        body: `${text}${who ? `, par ${who}` : ''}.`,
        link: '/allocations',
      },
    });
  }
}

/** Nouvelle collecte : le point de vente et son collecteur (les administrateurs sont prévenus à part). */
export async function notifyCollectionToPos(organizationId: string, actorId: string | null, collectionId: string) {
  const { rows } = await query(
    `SELECT c.pos_id, c.montant_collecte, c.commission
       FROM collections c
      WHERE c.id = $1 AND COALESCE(c.organization_id, c.organisation_id) = $2`,
    [collectionId, organizationId]
  );
  const c = rows[0];
  if (!c?.pos_id) return;
  const audience = await posAudience(c.pos_id as string, organizationId);
  if (!audience) return;
  const amount = fcfa(Number(c.montant_collecte || 0));
  const commission = Number(c.commission || 0);
  const who = await actorName(actorId);
  await dispatch(organizationId, actorId, audience, {
    pos: {
      type: 'pos.collection_recorded',
      title: 'Collecte enregistrée',
      body: `${amount} collectés à votre point de vente${commission > 0 ? `, commission de ${fcfa(commission)}` : ''}${who ? `, par ${who}` : ''}.`,
      link: '/collections',
      ring: true,
    },
    collector: {
      type: 'team.collection_created',
      title: `Collecte à ${audience.posName}`,
      body: `${amount} collectés${who ? ` par ${who}` : ''}.`,
      link: `/collections/${collectionId}`,
    },
  });
}

/** Échange de tickets (rendus contre reçus). */
export async function notifyExchange(
  organizationId: string,
  actorId: string | null,
  posId: string,
  returned: { ticket_type_id: string; quantite: number }[],
  received: { ticket_type_id: string; quantite: number }[]
) {
  const audience = await posAudience(posId, organizationId);
  if (!audience) return;
  const out = returned.length ? (await ticketSummary(returned, organizationId)).text : null;
  const inn = received.length ? (await ticketSummary(received, organizationId)).text : null;
  const detail = [out && `rendus : ${out}`, inn && `reçus : ${inn}`].filter(Boolean).join(' ; ');
  const who = await actorName(actorId);
  await dispatch(organizationId, actorId, audience, {
    pos: { type: 'pos.exchange', title: 'Échange de tickets', body: `${detail.charAt(0).toUpperCase()}${detail.slice(1)}.`, link: '/allocations', ring: true },
    collector: { type: 'team.exchange', title: `Échange de tickets à ${audience.posName}`, body: `${detail}${who ? `, par ${who}` : ''}.`, link: '/allocations' },
    admins: { type: 'team.exchange', title: `Échange de tickets à ${audience.posName}`, body: `${detail}${who ? `, par ${who}` : ''}.`, link: '/allocations' },
  });
}

/** Collecte ou allocation corrigée / supprimée (directement par l'administrateur, ou demande validée). */
export async function notifyRecordChanged(
  organizationId: string,
  actorId: string | null,
  type: 'collection' | 'allocation',
  row: Row,
  action: 'update' | 'delete',
  label: string,
  /** Déjà prévenu autrement (ex. le collecteur qui a demandé la correction) */
  skipUserId: string | null = null
) {
  const posId = row.pos_id as string | undefined;
  if (!posId) return;
  const audience = await posAudience(posId, organizationId);
  if (!audience) return;
  const what = type === 'collection' ? 'Collecte' : 'Allocation';
  const title = `${what} ${action === 'delete' ? 'supprimée' : 'corrigée'}`;
  const link = type === 'collection' ? '/collections' : '/allocations';
  const who = await actorName(actorId);
  const scoped = skipUserId && audience.collectorId === skipUserId ? { ...audience, collectorId: null } : audience;
  await dispatch(organizationId, actorId, scoped, {
    pos: { type: 'pos.record_changed', title, body: `${label}${who ? ` — par ${who}` : ''}.`, link, ring: true },
    collector: { type: 'team.record_changed', title, body: `${label}${who ? ` — par ${who}` : ''}.`, link },
    admins: { type: 'team.record_changed', title, body: `${label}${who ? ` — par ${who}` : ''}.`, link },
  });
  // Collecte saisie par un autre collecteur que celui du point de vente : il est prévenu aussi
  if (type === 'collection' && row.collecteur_id && row.collecteur_id !== audience.collectorId && row.collecteur_id !== actorId && row.collecteur_id !== skipUserId) {
    await notifyUsers([row.collecteur_id as string], { type: 'team.record_changed', title, body: `${label}${who ? ` — par ${who}` : ''}.`, link });
  }
}

/** Données d'un point de vente vidées par l'administrateur. */
export async function notifyPosReset(organizationId: string, actorId: string | null, posId: string) {
  const audience = await posAudience(posId, organizationId);
  if (!audience) return;
  const who = await actorName(actorId);
  await dispatch(organizationId, actorId, audience, {
    pos: {
      type: 'pos.reset',
      title: 'Point de vente remis à zéro',
      body: `Les allocations et collectes de votre point de vente ont été effacées${who ? ` par ${who}` : ''}.`,
      link: '/dashboard',
      ring: true,
    },
    collector: {
      type: 'team.pos_reset',
      title: `${audience.posName} remis à zéro`,
      body: `Allocations et collectes effacées${who ? ` par ${who}` : ''}.`,
      link: '/pos',
    },
    admins: {
      type: 'team.pos_reset',
      title: `${audience.posName} remis à zéro`,
      body: `Allocations et collectes effacées${who ? ` par ${who}` : ''}.`,
      link: `/pos/${posId}`,
    },
  });
}
