import { query } from '@/lib/neon/db';

/**
 * Périmètre d'un collecteur : les points de vente que l'administrateur de son organisation
 * lui a attribués, et les collectes faites sur ces points de vente (ou par lui ailleurs).
 * Utilisé côté serveur pour restreindre ce qu'un collecteur lit et écrit.
 */

/** Identifiant impossible : garde une clause `IN (...)` valide quand la liste est vide. */
export const NO_MATCH_ID = '00000000-0000-0000-0000-000000000000';

const nonEmpty = (ids: string[]) => (ids.length > 0 ? ids : [NO_MATCH_ID]);

/** Points de vente attribués au collecteur. */
export async function getAssignedPosIds(userId: string, organizationId: string): Promise<string[]> {
  const res = await query(
    `SELECT id FROM points_of_sale WHERE collecteur_id = $1 AND organization_id = $2`,
    [userId, organizationId],
  );
  return res.rows.map((r) => r.id as string);
}

/** Points de vente dont le collecteur voit les collectes : ceux qu'il gère et ceux où il a déjà collecté. */
export async function getVisiblePosIds(userId: string, organizationId: string): Promise<string[]> {
  const res = await query(
    `SELECT id FROM points_of_sale WHERE collecteur_id = $1 AND organization_id = $2
     UNION
     SELECT DISTINCT pos_id FROM collections
      WHERE collecteur_id = $1 AND COALESCE(organization_id, organisation_id) = $2`,
    [userId, organizationId],
  );
  return nonEmpty(res.rows.map((r) => r.id as string));
}

/** Collectes visibles par le collecteur (voir getVisiblePosIds). */
export async function getVisibleCollectionIds(userId: string, organizationId: string): Promise<string[]> {
  const posIds = await getVisiblePosIds(userId, organizationId);
  const res = await query(
    `SELECT id FROM collections
      WHERE pos_id = ANY($1::uuid[]) AND COALESCE(organization_id, organisation_id) = $2`,
    [posIds, organizationId],
  );
  return nonEmpty(res.rows.map((r) => r.id as string));
}

/** Vrai si toutes ces collectes ont été enregistrées par le collecteur. */
export async function ownsCollections(userId: string, organizationId: string, collectionIds: string[]): Promise<boolean> {
  const unique = [...new Set(collectionIds)];
  if (unique.length === 0) return false;
  const res = await query(
    `SELECT COUNT(*)::int AS n FROM collections
      WHERE id = ANY($1::uuid[]) AND collecteur_id = $2 AND COALESCE(organization_id, organisation_id) = $3`,
    [unique, userId, organizationId],
  );
  return Number(res.rows[0]?.n || 0) === unique.length;
}
