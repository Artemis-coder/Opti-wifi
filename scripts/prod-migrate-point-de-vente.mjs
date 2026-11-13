#!/usr/bin/env node
// ============================================================
// OPTIWIFI - Migrations « compte point de vente » (v1.12.0), base Neon.
// Regroupe, dans l'ordre :
//   supabase/migrations/20261112_point_de_vente_role.sql
//   supabase/migrations/20261112_plan_max_pos_accounts.sql
// Idempotent : peut être relancé sans effet (IF NOT EXISTS).
//
// Sécurités :
// - par défaut : SIMULATION, affiche seulement l'état (aucune écriture) ;
// - écriture uniquement avec --apply ET CONFIRM_PROD=yes pour la production ;
// - en production, exige une sauvegarde de moins de 2 h dans scripts/backups/
//   (node scripts/prod-backup-neon.mjs) ;
// - vérifie l'hôte : production = ep-flat-term (.env.production), dev = ep-crimson-shape (.env.local).
//
// Usage :
//   node scripts/prod-migrate-point-de-vente.mjs                     # état de la production
//   node scripts/prod-migrate-point-de-vente.mjs --env=dev           # état de la base dev
//   node scripts/prod-migrate-point-de-vente.mjs --env=dev --apply   # appliquer sur dev
//   CONFIRM_PROD=yes node scripts/prod-migrate-point-de-vente.mjs --apply   # appliquer sur la production
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

const args = process.argv.slice(2);
const target = args.includes('--env=dev') ? 'dev' : 'production';
const apply = args.includes('--apply');
const ENV = {
  production: { file: '.env.production', host: 'ep-flat-term' },
  dev: { file: '.env.local', host: 'ep-crimson-shape' },
}[target];

function readEnv(file, key) {
  const text = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
  const line = text.split('\n').find((l) => l.trim().startsWith(`${key}=`));
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : '';
}

const url = readEnv(ENV.file, 'DATABASE_URL');
if (!url.includes(ENV.host)) {
  console.error(`Refusé : DATABASE_URL de ${ENV.file} ne pointe pas sur ${target} (${ENV.host}).`);
  process.exit(1);
}
const sql = neon(url);

async function state() {
  const col = async (table, column) =>
    (await sql.query(`SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`, [table, column])).length === 1;
  const [roles] = await sql.query(`SELECT enum_range(NULL::user_role)::text AS r`);
  const indexes = (
    await sql.query(
      `SELECT indexname FROM pg_indexes WHERE indexname IN ('uniq_profiles_pos_account', 'idx_profiles_pos_account_phone')`,
    )
  ).map((r) => r.indexname);
  const hasPlanCol = await col('subscription_plans', 'max_pos_accounts');
  const plans = await sql.query(
    `SELECT name, ${hasPlanCol ? 'max_pos_accounts' : 'NULL::int AS max_pos_accounts'} FROM subscription_plans ORDER BY price`,
  );
  return {
    role_point_de_vente: roles.r.includes('point_de_vente'),
    profiles_pos_id: await col('profiles', 'pos_id'),
    points_of_sale_telephone: await col('points_of_sale', 'telephone'),
    subscription_plans_max_pos_accounts: hasPlanCol,
    index_acces_unique: indexes.includes('uniq_profiles_pos_account'),
    index_telephone: indexes.includes('idx_profiles_pos_account_phone'),
    forfaits: plans.map((p) => `${p.name} = ${p.max_pos_accounts === null ? 'illimité' : p.max_pos_accounts === 0 ? 'non inclus' : p.max_pos_accounts}`),
  };
}

console.log(`Base : ${target} (${ENV.host}) — ${apply ? 'APPLICATION' : 'simulation (aucune écriture)'}`);
console.log('Avant :', await state());
if (!apply) process.exit(0);

if (target === 'production') {
  if (process.env.CONFIRM_PROD !== 'yes') {
    console.error('Refusé : ajoutez CONFIRM_PROD=yes pour écrire sur la production.');
    process.exit(1);
  }
  const dir = path.resolve(process.cwd(), 'scripts/backups');
  const recent = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.startsWith('backup-prod-neon-') && Date.now() - fs.statSync(path.join(dir, f)).mtimeMs < 2 * 3600 * 1000)
    : [];
  if (recent.length === 0) {
    console.error('Refusé : aucune sauvegarde de production de moins de 2 h. Lancez d’abord : node scripts/prod-backup-neon.mjs');
    process.exit(1);
  }
  console.log('Sauvegarde récente :', recent.sort().at(-1));
}

// 1. Nouvelle valeur d'énumération : seule, hors transaction (elle doit être validée avant d'être utilisée)
await sql.query(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'point_de_vente'`);

// 2. Tout le reste en une seule transaction
await sql.transaction([
  sql.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pos_id UUID REFERENCES points_of_sale(id) ON DELETE SET NULL`),
  sql.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS uniq_profiles_pos_account ON profiles (pos_id)
      WHERE pos_id IS NOT NULL AND deleted_at IS NULL AND role = 'point_de_vente'`,
  ),
  sql.query(`ALTER TABLE points_of_sale ADD COLUMN IF NOT EXISTS telephone VARCHAR(50)`),
  sql.query(
    `CREATE INDEX IF NOT EXISTS idx_profiles_pos_account_phone ON profiles ((regexp_replace(telephone, '\\D', '', 'g')))
      WHERE role = 'point_de_vente' AND deleted_at IS NULL`,
  ),
  sql.query(`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_pos_accounts INT`),
  sql.query(
    `UPDATE subscription_plans SET max_pos_accounts = 0
      WHERE name = 'Découverte' AND max_pos_accounts IS NULL`,
  ),
]);

const after = await state();
console.log('Après :', after);
const ok =
  after.role_point_de_vente &&
  after.profiles_pos_id &&
  after.points_of_sale_telephone &&
  after.subscription_plans_max_pos_accounts &&
  after.index_acces_unique &&
  after.index_telephone;
console.log(ok ? '✅ Migration complète.' : '❌ Migration incomplète : vérifier le résultat ci-dessus.');
process.exit(ok ? 0 : 1);
