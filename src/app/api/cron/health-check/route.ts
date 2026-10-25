import { NextRequest, NextResponse } from 'next/server';
import { runAllHealthChecks } from '@/lib/db-health';

export async function GET(request: NextRequest) {
  const CRON_SECRET = process.env.CRON_SECRET;

  // Fail closed: if no CRON_SECRET configured, always deny
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'Endpoint non configuré.' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  try {
    await runAllHealthChecks();
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Never expose diagnostic details in cron responses
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}