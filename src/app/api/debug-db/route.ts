import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyToken, AUTH_COOKIE_NAME } from '@/lib/neon/auth';

export async function GET(request: Request) {
  try {
    // Require authentication
    const cookieHeader = request.headers.get('cookie');
    const token = cookieHeader
      ?.split(';')
      .find(c => c.trim().startsWith(AUTH_COOKIE_NAME + '='))
      ?.split('=')[1];

    if (!token || !verifyToken(token)) {
      return NextResponse.json({ ok: false, error: 'Non authentifié' }, { status: 401 });
    }

    const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json({ ok: false, error: 'DATABASE_URL not configured' }, { status: 500 });
    }
    const sql = neon(databaseUrl);

    // Check schema (limited - no host exposure)
    const schema = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'conversation_sessions'`;

    // Check all tables
    const tables = await sql`SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'public'`;

    // Test query
    const result = await sql.query('SELECT * FROM conversation_sessions WHERE chat_id = $1', ['test123']);

    return NextResponse.json({
      ok: true,
      schema: schema,
      tables: tables,
      queryResult: result
    });
  } catch (error) {
    console.error('Debug DB error:', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}