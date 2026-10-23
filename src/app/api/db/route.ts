import { type NextRequest, NextResponse } from 'next/server';
import { TableBuilder, makeError, type AuthUser } from '@/lib/neon/query-builder';
import { verifyToken, getUserById, AUTH_COOKIE_NAME } from '@/lib/neon/auth';
import { query } from '@/lib/neon/query-builder';

/**
 * Tables autorisées pour les requêtes client.
 * TOUTE table absente de cette liste sera bloquée (deny by default).
 * Ne jamais ajouter: users, platform_users, platform_audit_logs, organizations (accès admin seulement via API dédiée).
 */
const ALLOWED_TABLES_ALL_ROLES = new Set([
  'profiles',
  'wifi_spaces',
  'points_of_sale',
  'ticket_types',
  'ticket_allocations',
  'collections',
  'collection_items',
  'subscriptions',
  'subscription_plans',
]);

const ALLOWED_TABLES_ADMIN_ONLY = new Set([
  'audit_logs',
]);

/**
 * Colonnes sensibles à ne jamais exposer même si la table est autorisée.
 */
const BLOCKED_COLUMNS_BY_TABLE: Record<string, Set<string>> = {
  profiles: new Set(['devise']),
};

export async function POST(request: NextRequest) {
  try {
    // ── 1. Authentification obligatoire ──────────────────────────────────────
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ data: null, error: { message: 'Non authentifié.' } }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ data: null, error: { message: 'Session invalide ou expirée.' } }, { status: 401 });
    }

    const authUser: AuthUser | null = await getUserById(payload.sub);
    if (!authUser) {
      return NextResponse.json({ data: null, error: { message: 'Utilisateur introuvable.' } }, { status: 401 });
    }

    const body = await request.json();
    const {
      tableName, action, selectColumns, selectOpts,
      insertData, updateData, upsertData, upsertOpts,
      filters, order, limit, range, rpcName, rpcParams,
      single, maybeSingle,
    } = body;

    const table: string = (tableName || '').trim();

    // ── 2. Whitelist de tables (deny by default) ──────────────────────────────
    const isAdmin = authUser.role === 'administrateur';
    const tableAllowed =
      ALLOWED_TABLES_ALL_ROLES.has(table) ||
      (isAdmin && ALLOWED_TABLES_ADMIN_ONLY.has(table));

    if (!tableAllowed) {
      return NextResponse.json(
        { data: null, error: { message: `Accès non autorisé à la ressource "${table}".` } },
        { status: 403 }
      );
    }

    // ── 3. Validation de l'action (deny by default pour les actions destructives) ──
    const allowedActions = new Set(['select', 'insert', 'update', 'upsert']);
    // Les suppressions passent uniquement par des API dédiées, jamais via le proxy générique
    if (action === 'delete') {
      return NextResponse.json(
        { data: null, error: { message: 'Les suppressions doivent passer par les API dédiées.' } },
        { status: 403 }
      );
    }
    if (!allowedActions.has(action || 'select')) {
      return NextResponse.json(
        { data: null, error: { message: `Action "${action}" non autorisée.` } },
        { status: 403 }
      );
    }

    // ── 4. Nettoyage des colonnes sensibles ────────────────────────────────────
    let safeSelectColumns = selectColumns ?? null;
    if (safeSelectColumns && BLOCKED_COLUMNS_BY_TABLE[table]) {
      const blocked = BLOCKED_COLUMNS_BY_TABLE[table];
      const cols = safeSelectColumns.split(',').map((c: string) => c.trim());
      safeSelectColumns = cols.filter((c: string) => !blocked.has(c)).join(', ') || '*';
    }

    // ── 5. Injection du contexte utilisateur pour RLS ─────────────────────────
    await query('SELECT set_config($1, $2, false)', ['app.current_user_id', authUser.id]);
    await query('SELECT set_config($1, $2, false)', ['app.current_user_role', authUser.role || 'collecteur']);
    if (authUser.organization_id) {
      await query('SELECT set_config($1, $2, false)', ['app.current_org_id', authUser.organization_id]);
    }

    // ── 6. Exécution ─────────────────────────────────────────────────────────
    const builder = TableBuilder.fromSpec({
      tableName: table,
      action: action || 'select',
      selectColumns: safeSelectColumns,
      selectOpts: selectOpts ?? null,
      insertData: insertData ?? null,
      updateData: updateData ?? null,
      upsertData: upsertData ?? null,
      upsertOpts: upsertOpts ?? {},
      filters: filters || [],
      order: order || [],
      limit: limit ?? null,
      range: range ?? null,
      rpcName: rpcName ?? null,
      rpcParams: rpcParams ?? {},
      single: single || false,
      maybeSingle: maybeSingle || false,
    });

    const result = await builder.execute();
    return NextResponse.json(result);
  } catch (err: unknown) {
    // Ne jamais exposer les détails techniques en production
    const isDev = process.env.NODE_ENV !== 'production';
    const errMessage = isDev
      ? (err instanceof Error ? err.message : String(err))
      : 'Erreur de traitement de la requête.';
    return NextResponse.json({ data: null, error: makeError(errMessage) }, { status: 400 });
  }
}
