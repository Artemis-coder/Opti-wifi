// ============================================================
// OPTIWIFI - Export et suppression des données d'un espace client (RGPD)
// - Export : toutes les données de l'espace dans un fichier JSON (client et super admin)
// - Effacement : définitif, en une seule transaction, après validation du super admin
// ============================================================
import { getSql, query } from '@/lib/neon/db';

/** Données exportées, table par table (lecture seule) */
export async function exportOrganizationData(organizationId: string) {
  const one = async (sql: string) => (await query(sql, [organizationId])).rows;
  const [organization, members, spaces, pos, ticketTypes, allocations, collections, items, subscriptions, invoices, payments, licenseRequests, tickets, messages] =
    await Promise.all([
      one(`SELECT * FROM organizations WHERE id = $1`),
      // Comptes : jamais le mot de passe (il est dans la table users, non exportée)
      one(`SELECT id, nom, email, role, telephone, devise, is_active, created_at, updated_at FROM profiles WHERE organization_id = $1 ORDER BY created_at`),
      one(`SELECT * FROM wifi_spaces WHERE organization_id = $1 ORDER BY created_at`),
      one(`SELECT * FROM points_of_sale WHERE organization_id = $1 ORDER BY created_at`),
      one(`SELECT * FROM ticket_types WHERE organization_id = $1 ORDER BY created_at`),
      one(`SELECT * FROM ticket_allocations WHERE organization_id = $1 ORDER BY created_at`),
      one(`SELECT * FROM collections WHERE organization_id = $1 OR organisation_id = $1 ORDER BY created_at`),
      one(
        `SELECT ci.* FROM collection_items ci
          WHERE ci.organization_id = $1
             OR ci.collection_id IN (SELECT id FROM collections WHERE organization_id = $1 OR organisation_id = $1)`
      ),
      one(
        `SELECT s.*, p.name AS plan_name FROM subscriptions s
           LEFT JOIN subscription_plans p ON p.id = s.plan_id
          WHERE s.organization_id = $1 ORDER BY s.created_at`
      ),
      one(`SELECT * FROM invoices WHERE organization_id = $1 ORDER BY created_at`),
      one(`SELECT * FROM payments WHERE organization_id = $1 ORDER BY created_at`),
      one(`SELECT * FROM license_requests WHERE organization_id = $1 ORDER BY created_at`),
      one(`SELECT * FROM support_tickets WHERE organization_id = $1 ORDER BY created_at`),
      one(
        `SELECT m.* FROM support_messages m
          WHERE m.ticket_id IN (SELECT id FROM support_tickets WHERE organization_id = $1) ORDER BY m.created_at`
      ),
    ]);

  return {
    export: {
      format: 'OptiSpace — export des données v1',
      generated_at: new Date().toISOString(),
      organization_id: organizationId,
      contenu:
        'Espace, membres (sans mots de passe), zones, points de vente, types de tickets, allocations, collectes et leurs lignes, abonnements, factures, paiements, demandes de licence, tickets de support et messages.',
    },
    organization: organization[0] ?? null,
    members,
    wifi_spaces: spaces,
    points_of_sale: pos,
    ticket_types: ticketTypes,
    ticket_allocations: allocations,
    collections,
    collection_items: items,
    subscriptions,
    invoices,
    payments,
    license_requests: licenseRequests,
    support_tickets: tickets.map((t) => ({ ...t, messages: messages.filter((m) => m.ticket_id === t.id) })),
  };
}

/** Nom de fichier de l'export (sans caractère spécial) */
export function exportFileName(organizationName: string): string {
  const slug =
    organizationName
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 40) || 'espace';
  return `optispace-donnees-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
}

// Ordre d'effacement : des lignes qui dépendent des autres jusqu'à l'espace lui-même.
// Chaque étape renvoie le nombre de lignes supprimées (résumé gardé dans la demande).
const POS = `SELECT id FROM points_of_sale WHERE organization_id = $1`;
const COLLECTIONS = `SELECT id FROM collections WHERE organization_id = $1 OR organisation_id = $1 OR pos_id IN (${POS})`;
// Comptes de l'espace, sauf un éventuel compte du back-office (jamais supprimé ici)
const MEMBERS = `SELECT p.id FROM profiles p WHERE p.organization_id = $1
                   AND NOT EXISTS (SELECT 1 FROM platform_users pu WHERE pu.auth_user_id = p.id)`;

const DELETION_STEPS: { key: string; sql: string }[] = [
  { key: 'collection_items', sql: `DELETE FROM collection_items WHERE organization_id = $1 OR collection_id IN (${COLLECTIONS})` },
  { key: 'collections', sql: `DELETE FROM collections WHERE id IN (${COLLECTIONS})` },
  { key: 'ticket_allocations', sql: `DELETE FROM ticket_allocations WHERE organization_id = $1 OR pos_id IN (${POS})` },
  { key: 'points_of_sale', sql: `DELETE FROM points_of_sale WHERE organization_id = $1` },
  { key: 'ticket_types', sql: `DELETE FROM ticket_types WHERE organization_id = $1` },
  { key: 'wifi_spaces', sql: `DELETE FROM wifi_spaces WHERE organization_id = $1` },
  { key: 'invoices', sql: `DELETE FROM invoices WHERE organization_id = $1` },
  { key: 'payments', sql: `DELETE FROM payments WHERE organization_id = $1` },
  { key: 'license_requests', sql: `DELETE FROM license_requests WHERE organization_id = $1` },
  { key: 'support_tickets', sql: `DELETE FROM support_tickets WHERE organization_id = $1` },
  { key: 'subscriptions', sql: `DELETE FROM subscriptions WHERE organization_id = $1` },
  // Comptes : profils, notifications et abonnements push suivent (ON DELETE CASCADE)
  { key: 'users', sql: `DELETE FROM users WHERE id IN (${MEMBERS})` },
  { key: 'organizations', sql: `DELETE FROM organizations WHERE id = $1` },
];

/**
 * Efface définitivement l'espace et toutes ses données, en une seule transaction (tout ou
 * rien). Renvoie le nombre de lignes supprimées par table.
 */
export async function deleteOrganizationData(organizationId: string): Promise<Record<string, number>> {
  const sql = getSql();
  const results = await sql.transaction([
    // Un éventuel compte du back-office rattaché à l'espace est détaché, pas supprimé
    sql.query(`UPDATE profiles SET organization_id = NULL WHERE organization_id = $1 AND id IN (SELECT auth_user_id FROM platform_users)`, [organizationId]),
    ...DELETION_STEPS.map((s) => sql.query(`WITH d AS (${s.sql} RETURNING 1) SELECT count(*)::int AS n FROM d`, [organizationId])),
  ]);
  const summary: Record<string, number> = {};
  DELETION_STEPS.forEach((s, i) => {
    const rows = results[i + 1] as { n: number }[];
    summary[s.key] = Number(rows?.[0]?.n ?? 0);
  });
  return summary;
}
