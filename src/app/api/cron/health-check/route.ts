import { NextRequest, NextResponse } from 'next/server';
import { runAllHealthChecks } from '@/lib/db-health';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    await runAllHealthChecks();
    return NextResponse.json({ ok: true, message: 'Health checks completed' });
  } catch (error) {
    console.error('Cron health check failed:', error);
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 });
  }
}