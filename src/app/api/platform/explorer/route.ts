import { NextResponse } from 'next/server';
import { getPlatformUserFromSession } from '@/lib/supabase/platform';
import { query } from '@/lib/neon/db';
import type { ExplorerEntity } from '@/types/platform';

// Explorateur en lecture seule des données métier de toutes les organisations.
// Chaque requête reçoit : $1 organisation (ou NULL), $2 motif de recherche (ou NULL), $3 limit, $4 offset.
const ENTITY_QUERIES: Record<ExplorerEntity, string> = {
  spaces: `
    SELECT s.id, s.nom, s.ville, s.adresse, s.statut, s.created_at,
           o.id AS org_id, o.name AS org_name,
           (SELECT COUNT(*) FROM points_of_sale p WHERE p.space_id = s.id) AS pos_count,
           COUNT(*) OVER() AS total_count
      FROM wifi_spaces s
      LEFT JOIN organizations o ON o.id = s.organization_id
     WHERE ($1::uuid IS NULL OR s.organization_id = $1::uuid)
       AND ($2::text IS NULL OR s.nom ILIKE $2 OR s.ville ILIKE $2)
     ORDER BY s.created_at DESC
     LIMIT $3 OFFSET $4`,
  pos: `
    SELECT p.id, p.nom, p.ville, p.statut, p.created_at,
           s.nom AS space_name, pr.nom AS collecteur_name,
           o.id AS org_id, o.name AS org_name,
           COUNT(*) OVER() AS total_count
      FROM points_of_sale p
      LEFT JOIN wifi_spaces s ON s.id = p.space_id
      LEFT JOIN profiles pr ON pr.id = p.collecteur_id
      LEFT JOIN organizations o ON o.id = p.organization_id
     WHERE ($1::uuid IS NULL OR p.organization_id = $1::uuid)
       AND ($2::text IS NULL OR p.nom ILIKE $2 OR p.ville ILIKE $2)
     ORDER BY p.created_at DESC
     LIMIT $3 OFFSET $4`,
  ticket_types: `
    SELECT t.id, t.nom, t.duree_heures, t.prix, t.actif, t.created_at,
           s.nom AS space_name,
           o.id AS org_id, o.name AS org_name,
           COUNT(*) OVER() AS total_count
      FROM ticket_types t
      LEFT JOIN wifi_spaces s ON s.id = t.space_id
      LEFT JOIN organizations o ON o.id = t.organization_id
     WHERE ($1::uuid IS NULL OR t.organization_id = $1::uuid)
       AND ($2::text IS NULL OR t.nom ILIKE $2)
     ORDER BY t.created_at DESC
     LIMIT $3 OFFSET $4`,
  collections: `
    SELECT c.id, COALESCE(c.date_collecte, c.created_at::date) AS date, c.statut,
           c.montant_attendu, c.montant_collecte, c.difference, c.commission, c.created_at,
           p.nom AS pos_name, pr.nom AS collecteur_name,
           o.id AS org_id, o.name AS org_name,
           COUNT(*) OVER() AS total_count
      FROM collections c
      LEFT JOIN points_of_sale p ON p.id = c.pos_id
      LEFT JOIN profiles pr ON pr.id = c.collecteur_id
      LEFT JOIN organizations o ON o.id = COALESCE(c.organization_id, c.organisation_id)
     WHERE ($1::uuid IS NULL OR COALESCE(c.organization_id, c.organisation_id) = $1::uuid)
       AND ($2::text IS NULL OR p.nom ILIKE $2 OR pr.nom ILIKE $2)
     ORDER BY c.created_at DESC
     LIMIT $3 OFFSET $4`,
  allocations: `
    SELECT a.id, COALESCE(a.date_allocation, a.created_at::date) AS date, a.type, a.quantite, a.statut, a.created_at,
           p.nom AS pos_name, tt.nom AS ticket_type_name, tt.prix AS ticket_price,
           o.id AS org_id, o.name AS org_name,
           COUNT(*) OVER() AS total_count
      FROM ticket_allocations a
      LEFT JOIN points_of_sale p ON p.id = a.pos_id
      LEFT JOIN ticket_types tt ON tt.id = a.ticket_type_id
      LEFT JOIN organizations o ON o.id = a.organization_id
     WHERE ($1::uuid IS NULL OR a.organization_id = $1::uuid)
       AND ($2::text IS NULL OR p.nom ILIKE $2 OR tt.nom ILIKE $2)
     ORDER BY a.created_at DESC
     LIMIT $3 OFFSET $4`,
  users: `
    SELECT pr.id, pr.nom, pr.email, pr.role, pr.telephone, pr.created_at,
           o.id AS org_id, o.name AS org_name,
           COUNT(*) OVER() AS total_count
      FROM profiles pr
      LEFT JOIN organizations o ON o.id = pr.organization_id
     WHERE ($1::uuid IS NULL OR pr.organization_id = $1::uuid)
       AND ($2::text IS NULL OR pr.nom ILIKE $2 OR pr.email ILIKE $2)
     ORDER BY pr.created_at DESC
     LIMIT $3 OFFSET $4`,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PAGE_SIZE = 100;

export async function GET(request: Request) {
  const auth = await getPlatformUserFromSession();
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const entity = searchParams.get('entity') as ExplorerEntity | null;
  if (!entity || !(entity in ENTITY_QUERIES)) {
    return NextResponse.json({ error: 'Type de données invalide' }, { status: 400 });
  }

  const orgParam = searchParams.get('org');
  if (orgParam && !UUID_RE.test(orgParam)) {
    return NextResponse.json({ error: 'Organisation invalide' }, { status: 400 });
  }
  const org = orgParam || null;

  const q = (searchParams.get('q') || '').trim().slice(0, 100);
  // Échapper les jokers LIKE saisis par l'utilisateur.
  const pattern = q ? `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%` : null;

  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(searchParams.get('pageSize') || '25', 10) || 25)
  );

  try {
    const [dataRes, orgsRes] = await Promise.all([
      query(ENTITY_QUERIES[entity], [org, pattern, pageSize, (page - 1) * pageSize]),
      query('SELECT id, name FROM organizations ORDER BY name ASC'),
    ]);

    const total = Number(dataRes.rows[0]?.total_count || 0);
    const rows = dataRes.rows.map((row) => {
      const rest = { ...row };
      delete rest.total_count;
      return rest;
    });

    return NextResponse.json({
      data: rows,
      total,
      page,
      pageSize,
      organizations: orgsRes.rows,
    });
  } catch (err) {
    console.error('Platform explorer error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement des données' }, { status: 500 });
  }
}
