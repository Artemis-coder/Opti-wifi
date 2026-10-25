import { type NextRequest, NextResponse } from 'next/server';
import { TableBuilder, makeError, type QuerySpec } from '@/lib/neon/query-builder';
import { AUTH_COOKIE_NAME } from '@/lib/neon/auth';
import { getSessionContext, type SessionContext } from '@/lib/tenant';

// Passerelle générique utilisée par le client navigateur (lib/supabase/client).
// Règles imposées côté serveur :
//  - session obligatoire ;
//  - liste blanche de tables et d'actions ;
//  - identifiants (tables, colonnes, alias) validés pour empêcher toute injection SQL ;
//  - pour un client, toutes les lectures/écritures sont restreintes à son organisation.

type Action = QuerySpec['action'];

interface TablePolicy {
  actions: Action[];
  /** Comment restreindre la table au périmètre de l'utilisateur. */
  scope: 'organization' | 'own_organization_row' | 'own_platform_user' | 'none';
}

const CLIENT_POLICIES: Record<string, TablePolicy> = {
  wifi_spaces: { actions: ['select', 'insert', 'update', 'delete'], scope: 'organization' },
  points_of_sale: { actions: ['select', 'insert', 'update', 'delete'], scope: 'organization' },
  ticket_types: { actions: ['select', 'insert', 'update', 'delete'], scope: 'organization' },
  ticket_allocations: { actions: ['select', 'insert', 'update', 'delete'], scope: 'organization' },
  collections: { actions: ['select', 'insert', 'update', 'delete'], scope: 'organization' },
  collection_items: { actions: ['select', 'insert', 'update', 'delete'], scope: 'organization' },
  profiles: { actions: ['select', 'update'], scope: 'organization' },
  subscriptions: { actions: ['select'], scope: 'organization' },
  license_requests: { actions: ['select'], scope: 'organization' },
  organizations: { actions: ['select'], scope: 'own_organization_row' },
  subscription_plans: { actions: ['select'], scope: 'none' },
  platform_users: { actions: ['select'], scope: 'own_platform_user' },
};

// Le super admin lit et modifie toutes les organisations, mais jamais la table des comptes (hash de mots de passe).
const PLATFORM_ADMIN_TABLES = new Set([...Object.keys(CLIENT_POLICIES)]);

// Tables lisibles via une jointure (alias:table(...)) depuis une requête autorisée.
const JOINABLE_TABLES = new Set(Object.keys(CLIENT_POLICIES).filter((t) => t !== 'platform_users'));

// Organisation suspendue / supprimée / refusée / en attente : lecture seule de ce qui sert
// à afficher l'écran de statut (profil, organisation, abonnement), rien d'autre.
const BLOCKED_ORG_READABLE_TABLES = new Set(['profiles', 'organizations', 'subscriptions', 'subscription_plans', 'license_requests', 'platform_users']);

// Colonnes qu'un client ne peut jamais fixer lui-même.
const PROTECTED_COLUMNS = new Set(['organization_id', 'organisation_id']);

const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const NESTED_RE = /(\w+):(\w+)(!inner|!left)?\(([^)]*)\)/g;

class ForbiddenError extends Error {}

function assertIdent(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !IDENT_RE.test(value)) {
    throw new ForbiddenError(`${label} invalide`);
  }
}

function assertColumnList(list: string, label: string) {
  for (const col of list.split(',').map((c) => c.trim()).filter(Boolean)) {
    if (col !== '*') assertIdent(col, label);
  }
}

function validateSelect(selectColumns: string | null) {
  if (!selectColumns) return;
  if (!/^[\w\s,*:!()]*$/.test(selectColumns)) throw new ForbiddenError('Sélection invalide');
  for (const m of selectColumns.matchAll(NESTED_RE)) {
    assertIdent(m[1], 'Alias');
    if (!JOINABLE_TABLES.has(m[2])) throw new ForbiddenError('Jointure non autorisée');
    assertColumnList(m[4], 'Colonne');
  }
  const main = selectColumns.replace(NESTED_RE, '');
  if (/[():!]/.test(main)) throw new ForbiddenError('Sélection invalide');
  assertColumnList(main, 'Colonne');
}

function validateRows(rows: unknown, label: string): Record<string, unknown>[] {
  const list = Array.isArray(rows) ? rows : [rows];
  for (const row of list) {
    if (!row || typeof row !== 'object') throw new ForbiddenError(`${label} invalides`);
    for (const key of Object.keys(row)) assertIdent(key, 'Colonne');
  }
  return list as Record<string, unknown>[];
}

function buildSpec(body: Partial<QuerySpec>, ctx: SessionContext): QuerySpec {
  const tableName = body.tableName;
  const action: Action = body.action || 'select';
  assertIdent(tableName, 'Table');

  const policy = CLIENT_POLICIES[tableName];
  if (!policy) throw new ForbiddenError('Table non autorisée');
  if (ctx.isPlatformAdmin) {
    if (!PLATFORM_ADMIN_TABLES.has(tableName) || action === 'rpc') throw new ForbiddenError('Action non autorisée');
  } else if (!policy.actions.includes(action)) {
    throw new ForbiddenError('Action non autorisée');
  } else if (ctx.organizationBlocked && (action !== 'select' || !BLOCKED_ORG_READABLE_TABLES.has(tableName))) {
    throw new ForbiddenError('Accès suspendu pour cette organisation');
  }

  const filters = Array.isArray(body.filters) ? [...body.filters] : [];
  for (const f of filters) {
    assertIdent(f?.column, 'Colonne');
    if (!['=', '!=', '>', '>=', '<', '<=', 'LIKE', 'ILIKE', 'IN'].includes(f.operator)) {
      throw new ForbiddenError('Opérateur invalide');
    }
    if (f.operator === 'IN' && !Array.isArray(f.value)) throw new ForbiddenError('Filtre invalide');
  }
  const order = Array.isArray(body.order) ? body.order : [];
  for (const o of order) assertIdent(o?.column, 'Colonne de tri');
  validateSelect(body.selectColumns ?? null);

  let insertData = body.insertData ?? null;
  let updateData = body.updateData ?? null;
  if (insertData) insertData = validateRows(insertData, 'Données');
  if (updateData) validateRows(updateData, 'Données');
  if (body.upsertData) validateRows(body.upsertData, 'Données');
  if (body.upsertOpts?.onConflict) assertColumnList(body.upsertOpts.onConflict, 'Colonne');

  // --- Restriction au périmètre de l'utilisateur ---
  if (!ctx.isPlatformAdmin) {
    const org = ctx.organizationId;
    const and = (column: string, value: string) => filters.push({ column, operator: '=', value, logic: 'and' });

    switch (policy.scope) {
      case 'organization': {
        if (!org) throw new ForbiddenError('Aucune organisation associée');
        if (action === 'insert') {
          insertData = (insertData as Record<string, unknown>[]).map((row) => ({ ...row, organization_id: org }));
        } else {
          and('organization_id', org);
        }
        if (action === 'update' && updateData) {
          const clean = { ...updateData };
          for (const col of PROTECTED_COLUMNS) delete clean[col];
          // Un collecteur ne modifie que son propre profil, et jamais son rôle.
          if (tableName === 'profiles' && ctx.role !== 'administrateur') {
            delete clean.role;
            and('id', ctx.userId);
          }
          updateData = clean;
        }
        break;
      }
      case 'own_organization_row':
        if (!org) throw new ForbiddenError('Aucune organisation associée');
        and('id', org);
        break;
      case 'own_platform_user':
        and('auth_user_id', ctx.userId);
        break;
      case 'none':
        break;
    }
  }

  // insert renvoie la ligne via .select() : on garde une structure homogène
  const unwrapInsert =
    insertData && !Array.isArray(body.insertData) && Array.isArray(insertData) ? insertData[0] : insertData;

  return {
    tableName,
    action,
    selectColumns: body.selectColumns ?? null,
    selectOpts: body.selectOpts ?? null,
    insertData: unwrapInsert,
    updateData,
    upsertData: body.upsertData ?? null,
    upsertOpts: body.upsertOpts ?? {},
    filters,
    order,
    limit: typeof body.limit === 'number' ? body.limit : null,
    range: body.range ?? null,
    rpcName: null,
    rpcParams: {},
    single: !!body.single,
    maybeSingle: !!body.maybeSingle,
  };
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request.cookies.get(AUTH_COOKIE_NAME)?.value ?? null);
  if (!ctx) {
    return NextResponse.json({ data: null, error: makeError('Non authentifié') }, { status: 401 });
  }

  let spec: QuerySpec;
  try {
    spec = buildSpec(await request.json(), ctx);
  } catch (err) {
    const message = err instanceof ForbiddenError ? err.message : 'Requête invalide';
    return NextResponse.json({ data: null, error: makeError(message) }, { status: 403 });
  }

  // Une mise à jour ou suppression sans aucun filtre toucherait toute la table.
  if ((spec.action === 'update' || spec.action === 'delete') && spec.filters.length === 0) {
    return NextResponse.json({ data: null, error: makeError('Filtre requis') }, { status: 403 });
  }

  try {
    const result = await TableBuilder.fromSpec(spec).execute();
    return NextResponse.json(result);
  } catch (err) {
    console.error('API db error:', err);
    return NextResponse.json({ data: null, error: makeError('Erreur base de données') }, { status: 400 });
  }
}
