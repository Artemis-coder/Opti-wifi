// Sauvegarde de la base de PRODUCTION en lecture seule (JSON : toutes les tables du schéma public).
// Lancer avec `npm run backup:prod` (récupère l'adresse de la base depuis Vercel sans l'écrire dans le projet).
import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url || !url.includes('ep-flat-term-aymd9rhb')) throw new Error('Refus : base de production attendue');
const sql = neon(url);
const tables = (await sql.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1`)).map((r) => r.table_name);
const out = { created_at: new Date().toISOString(), source: 'production', tables: {} };
let rows = 0;
for (const t of tables) {
  const [data] = await sql.transaction([sql.query(`SELECT * FROM "${t}"`)], { readOnly: true });
  out.tables[t] = data;
  rows += data.length;
}
const dir = process.argv[2] || 'scripts/backups';
fs.mkdirSync(dir, { recursive: true });
const previous = fs.readdirSync(dir).filter((f) => /^backup-prod-neon-.*\.json$/.test(f)).sort().pop();
const file = path.join(dir, `backup-prod-neon-${out.created_at.replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(file, JSON.stringify(out));
console.log(`fichier: ${path.basename(file)} | ${(fs.statSync(file).size / 1024).toFixed(1)} Ko | ${tables.length} tables | ${rows} lignes`);

// Comparaison avec la sauvegarde précédente : une table qui perd des lignes mérite un coup d'œil
if (previous) {
  const before = JSON.parse(fs.readFileSync(path.join(dir, previous), 'utf8')).tables;
  const lost = Object.keys(before).filter((t) => (out.tables[t]?.length ?? 0) < before[t].length);
  console.log(
    lost.length
      ? `ATTENTION, lignes en moins depuis ${previous} : ${lost.map((t) => `${t} ${before[t].length} -> ${out.tables[t]?.length ?? 0}`).join(', ')}`
      : `aucune table en baisse depuis ${previous}`,
  );
}
