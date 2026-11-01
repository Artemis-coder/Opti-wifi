import { NextResponse } from 'next/server';

// Test de connexion (indicateur en ligne / hors ligne) : jamais mis en cache,
// ni par le navigateur ni par le service worker.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
