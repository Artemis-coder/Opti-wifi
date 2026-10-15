import { NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/conversation-memory';
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

    const session = await getOrCreateSession('test123');
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    console.error('Test DB error:', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}