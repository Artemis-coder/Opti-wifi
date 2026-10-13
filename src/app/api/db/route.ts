import { type NextRequest, NextResponse } from 'next/server';
import { TableBuilder, makeError, type SupabaseError, type AuthUser } from '@/lib/neon/query-builder';
import { verifyToken, getUserById, AUTH_COOKIE_NAME } from '@/lib/neon/auth';
import { query } from '@/lib/neon/query-builder';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tableName, action, selectColumns, selectOpts, insertData, updateData, upsertData, upsertOpts, filters, order, limit, range, rpcName, rpcParams, single, maybeSingle } = body;

    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    let authUser: AuthUser | null = null;

    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        authUser = await getUserById(payload.sub);
      }
    }

    if (authUser) {
      await query('SELECT set_config($1, $2, false)', ['app.current_user_id', authUser.id]);
      await query('SELECT set_config($1, $2, false)', ['app.current_user_role', authUser.role]);
      if (authUser.organization_id) {
        await query('SELECT set_config($1, $2, false)', ['app.current_org_id', authUser.organization_id]);
      }
    }

    const builder = TableBuilder.fromSpec({
      tableName: tableName || '',
      action: action || 'select',
      selectColumns: selectColumns ?? null,
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
    return NextResponse.json({ data: null, error: makeError(err instanceof Error ? err.message : String(err) || 'Database error') }, { status: 400 });
  }
}
