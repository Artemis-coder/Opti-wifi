import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/neon/server';
import { getEnvironmentSummary, validateDatabaseConnection } from '@/lib/env-guard';

// Diagnostic d'isolation (quelle base, quel environnement) : super admin uniquement.
// Ne renvoie plus la liste des tables ni de données, seulement le résumé masqué de l'environnement.
export async function GET() {
  const admin = await requirePlatformAdmin();
  if ('error' in admin) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }
  try {
    const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json({ ok: false, error: 'DATABASE_URL non configurée' }, { status: 500 });
    }
    validateDatabaseConnection(databaseUrl);
    return NextResponse.json({ ok: true, environment: getEnvironmentSummary(databaseUrl) });
  } catch (error) {
    console.error('Debug DB error:', error);
    return NextResponse.json({ ok: false, error: 'Configuration de base invalide' }, { status: 500 });
  }
}
