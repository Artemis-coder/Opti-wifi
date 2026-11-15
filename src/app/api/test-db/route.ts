import { NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/conversation-memory';
import { requirePlatformAdmin } from '@/lib/neon/server';

// Vérification de la mémoire de conversation du bot : super admin uniquement.
export async function GET() {
  const admin = await requirePlatformAdmin();
  if ('error' in admin) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }
  try {
    const session = await getOrCreateSession('test123');
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    console.error('Test DB error:', error);
    return NextResponse.json({ ok: false, error: 'Erreur base de données' }, { status: 500 });
  }
}
