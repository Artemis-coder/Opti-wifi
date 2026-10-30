import { NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { getSessionContext } from '@/lib/tenant';
import { findCountry, formatInternationalPhone, isValidNationalNumber } from '@/lib/countries';

// Mise à jour du profil (nom, téléphone avec pays). Pour le gérant, le téléphone et le pays
// de l'organisation sont complétés s'ils manquent (KPI « Top 3 des pays »).
export async function PATCH(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const nom = typeof body.nom === 'string' ? body.nom.trim().slice(0, 120) : '';
  if (!nom) return NextResponse.json({ error: 'Le nom est obligatoire.' }, { status: 400 });

  const country = findCountry(typeof body.country === 'string' ? body.country : '');
  const national = typeof body.phone === 'string' ? body.phone : '';
  if (!country || !isValidNationalNumber(national)) {
    return NextResponse.json(
      { error: 'Numéro de téléphone invalide : choisissez le pays puis saisissez le numéro (6 à 14 chiffres).' },
      { status: 400 }
    );
  }
  const telephone = formatInternationalPhone(country, national);

  try {
    await query(`UPDATE profiles SET nom = $2, telephone = $3, updated_at = NOW() WHERE id = $1`, [ctx.userId, nom, telephone]);
    if (ctx.organizationId && ctx.role === 'administrateur') {
      await query(
        `UPDATE organizations
            SET phone = COALESCE(NULLIF(btrim(phone), ''), $2),
                country = COALESCE(country, $3),
                updated_at = NOW()
          WHERE id = $1`,
        [ctx.organizationId, telephone, country.code]
      );
    }
    return NextResponse.json({ success: true, data: { nom, telephone } });
  } catch (err) {
    console.error('Profile update error:', err);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour du profil.' }, { status: 500 });
  }
}
