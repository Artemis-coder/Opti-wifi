#!/usr/bin/env node
// ============================================================
// OPTIWIFI - Sauvegarde de la base Neon de PRODUCTION (lecture seule).
// Remplace « npm run backup » (obsolète : API Supabase).
// - Lit DATABASE_URL dans .env.production (jamais affichée) et vérifie que c'est bien la
//   production (ep-flat-term) ;
// - copie toutes les tables du schéma public dans UNE transaction en LECTURE SEULE
//   (aucune écriture possible) ;
// - écrit scripts/backups/backup-prod-neon-<date>.json (dossier ignoré par Git).
//
// Usage : node scripts/prod-backup-neon.mjs
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

const PROD_HOST = 'ep-flat-term';

function readEnv(file, key) {
  const text = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
  const line = text.split('\n').find((l) => l.trim().startsWith(`${key}=`));
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : '';
}

const url = readEnv('.env.production', 'DATABASE_URL');
if (!url.includes(PROD_HOST)) {
  console.error(`Refusé : DATABASE_URL de .env.production ne pointe pas sur la production (${PROD_HOST}).`);
  process.exit(1);
}

const sql = neon(url);
const tables = (
  await sql.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
  )
).map((r) => r.table_name);

// Une seule transaction en lecture seule : instantané cohérent, aucune écriture possible
const results = await sql.transaction(
  tables.map((t) => sql.query(`SELECT * FROM "${t.replace(/"/g, '""')}"`)),
  { readOnly: true, isolationLevel: 'RepeatableRead' },
);

const backup = { created_at: new Date().toISOString(), source: `neon production (${PROD_HOST})`, tables: {} };
tables.forEach((t, i) => {
  backup.tables[t] = results[i];
});

const dir = path.resolve(process.cwd(), 'scripts/backups');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `backup-prod-neon-${backup.created_at.replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(file, JSON.stringify(backup));

const rows = Object.values(backup.tables).reduce((n, r) => n + r.length, 0);
console.log(`Sauvegarde terminée : ${tables.length} tables, ${rows} lignes`);
console.log(`Fichier : ${path.relative(process.cwd(), file)} (${(fs.statSync(file).size / 1024).toFixed(0)} Ko)`);
