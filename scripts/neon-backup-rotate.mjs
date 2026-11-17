#!/usr/bin/env node
// Rotation des branches de sauvegarde Neon (npm run backup:prod, étape 2).
// Avant de créer une nouvelle branche backup-prod-*, supprime les plus anciennes pour :
//   - n'en garder que KEEP (la nouvelle comprise) ;
//   - laisser au moins une place libre sous la limite du projet Neon (10 branches).
// Ne touche QU'AUX branches nommées backup-prod-AAAAMMJJ-HHMM, enfants de la production,
// ni par défaut ni protégées. Les fichiers JSON (scripts/backups/) restent la sauvegarde longue durée.
//
// Usage : node scripts/neon-backup-rotate.mjs <projet> <branche-parente> [--keep=3] [--limit=10] [--dry-run]
import { execFileSync } from 'node:child_process';

const [project, parentName, ...flags] = process.argv.slice(2);
if (!project || !parentName) {
  console.error('Usage : node scripts/neon-backup-rotate.mjs <projet> <branche-parente> [--keep=3] [--limit=10] [--dry-run]');
  process.exit(2);
}
const opt = (name, def) => Number(flags.find((f) => f.startsWith(`--${name}=`))?.split('=')[1] ?? def);
const KEEP = opt('keep', 3);
const LIMIT = opt('limit', 10);
const DRY_RUN = flags.includes('--dry-run');
const BACKUP_NAME = /^backup-prod-\d{8}-\d{4}$/;

const neon = (args) => execFileSync('neonctl', [...args, '--project-id', project, '--output', 'json'], { encoding: 'utf8' });

const listed = JSON.parse(neon(['branches', 'list']));
const branches = listed.branches ?? listed;
const parent = branches.find((b) => b.name === parentName);
if (!parent) {
  console.error(`Branche parente « ${parentName} » introuvable.`);
  process.exit(1);
}

const backups = branches
  .filter((b) => BACKUP_NAME.test(b.name) && b.parent_id === parent.id && !b.default && !b.protected)
  .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); // plus anciennes d'abord

// Après création : backups restants + 1 ≤ KEEP, et total + 1 ≤ LIMIT - 1 (une place libre)
const toDelete = [];
let remainingBackups = backups.length;
let total = branches.length;
for (const b of backups) {
  if (remainingBackups + 1 <= KEEP && total + 1 <= LIMIT - 1) break;
  toDelete.push(b);
  remainingBackups -= 1;
  total -= 1;
}

if (total + 1 > LIMIT) {
  console.error(
    `Plus de place sur le projet Neon (${total}/${LIMIT} branches) et aucune sauvegarde backup-prod-* à supprimer : ` +
      'libérez une branche à la main (console Neon) puis relancez.'
  );
  process.exit(1);
}

if (toDelete.length === 0) {
  console.log(`rotation : rien à supprimer (${backups.length} sauvegarde(s), ${branches.length}/${LIMIT} branches)`);
}
for (const b of toDelete) {
  if (DRY_RUN) {
    console.log(`rotation (simulation) : supprimerait ${b.name} (${b.id}, créée le ${b.created_at})`);
  } else {
    neon(['branches', 'delete', b.id]);
    console.log(`rotation : ${b.name} supprimée (créée le ${b.created_at})`);
  }
}
