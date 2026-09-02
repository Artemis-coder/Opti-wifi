#!/usr/bin/env node
/**
 * OPTIWIFI - Backup & Restore Script
 * ====================================
 * Sauvegarde et restaure toutes les données de la base Supabase.
 *
 * Usage:
 *   node scripts/backup.js                    # Sauvegarde
 *   node scripts/backup.js --restore=<fichier> # Restauration
 *   node scripts/backup.js --list             # Liste les sauvegardes
 *   node scripts/backup.js --clean=<jours>    # Supprime les sauvegardes plus anciennes
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Charger les variables d'environnement depuis .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex);
        let value = trimmed.substring(eqIndex + 1);
        // Supprimer les guillemets
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Variables NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises dans .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const BACKUP_DIR = path.join(__dirname, 'backups');
const TABLES = [
  'wifi_spaces',
  'profiles',
  'points_of_sale',
  'ticket_types',
  'ticket_allocations',
  'collections',
  'collection_items',
  'audit_logs'
];

// Créer le dossier de sauvegarde si nécessaire
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Exporte une table en JSON
 */
async function exportTable(tableName) {
  const { data, error, count } = await supabase
    .from(tableName)
    .select('*', { count: 'exact' });

  if (error) {
    console.error(`  ⚠️ Erreur sur ${tableName}: ${error.message}`);
    return null;
  }
  return data || [];
}

/**
 * Crée une sauvegarde complète de la base
 */
async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${timestamp}.json`;
  const filepath = path.join(BACKUP_DIR, filename);

  console.log('📦 Création de la sauvegarde...\n');

  const backup = {
    version: 1,
    created_at: new Date().toISOString(),
    supabase_url: SUPABASE_URL,
    tables: {}
  };

  for (const table of TABLES) {
    process.stdout.write(`  Table ${table}... `);
    const data = await exportTable(table);
    if (data !== null) {
      backup.tables[table] = data;
      console.log(`✓ ${data.length} lignes`);
    } else {
      console.log('✗ erreur');
    }
  }

  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), 'utf-8');

  console.log(`\n✅ Sauvegarde créée: ${filename}`);
  console.log(`   Emplacement: ${filepath}`);
  console.log(`   Taille: ${(fs.statSync(filepath).size / 1024).toFixed(1)} KB`);

  // Créer un lien "latest"
  const latestPath = path.join(BACKUP_DIR, 'backup-latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(backup, null, 2), 'utf-8');
  console.log(`   Lien latest: ${latestPath}`);

  return filepath;
}

/**
 * Restaure une sauvegarde
 */
async function restoreBackup(filepath) {
  if (!fs.existsSync(filepath)) {
    console.error(`❌ Fichier de sauvegarde introuvable: ${filepath}`);
    process.exit(1);
  }

  const backup = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

  if (!backup.tables) {
    console.error('❌ Format de sauvegarde invalide');
    process.exit(1);
  }

  console.log(`🔄 Restauration de: ${path.basename(filepath)}`);
  console.log(`   Créé le: ${backup.created_at}\n`);

  for (const table of TABLES) {
    if (!backup.tables[table]) {
      console.log(`  ${table}: aucune donnée (ignoré)`);
      continue;
    }

    const rows = backup.tables[table];
    if (rows.length === 0) {
      console.log(`  ${table}: 0 lignes (ignoré)`);
      continue;
    }

    process.stdout.write(`  ${table}: ${rows.length} lignes... `);

    // Pour les tables avec contraintes, vider d'abord
    const truncateFirst = ['ticket_allocations', 'collection_items', 'collections'];

    if (truncateFirst.includes(table)) {
      const { error: truncateError } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (truncateError) {
        // Ignorer les erreurs de truncate
      }
    }

    // Insérer les données
    const { error } = await supabase.from(table).insert(rows);

    if (error) {
      console.log(`✗ erreur: ${error.message}`);
      console.log(`   Essayons avec upsert...`);

      // Essayer avec upsert
      const { error: upsertError } = await supabase.from(table).upsert(rows, {
        onConflict: 'id'
      });

      if (upsertError) {
        console.log(`   ⚠️ Erreur upsert: ${upsertError.message}`);
      } else {
        console.log(`✓ (upsert)`);
      }
    } else {
      console.log(`✓`);
    }
  }

  console.log('\n✅ Restauration terminée');
  console.log('   Note: Les IDs sont préservés. Vérifiez les relations dans Supabase.');
}

/**
 * Liste les sauvegardes disponibles
 */
function listBackups() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.json') && f !== 'backup-latest.json')
    .map(f => {
      const stats = fs.statSync(path.join(BACKUP_DIR, f));
      return { name: f, size: stats.size, date: stats.mtime };
    })
    .sort((a, b) => b.date - a.date);

  if (files.length === 0) {
    console.log('Aucune sauvegarde trouvée');
    return;
  }

  console.log('📁 Sauvegardes disponibles:\n');
  for (const file of files) {
    const size = (file.size / 1024).toFixed(1);
    const date = file.date.toLocaleString('fr-FR');
    console.log(`   ${file.name}`);
    console.log(`      ${size} KB - ${date}\n`);
  }
}

/**
 * Supprime les anciennes sauvegardes
 */
function cleanOldBackups(days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
    .map(f => {
      const stats = fs.statSync(path.join(BACKUP_DIR, f));
      return { name: f, date: stats.mtime };
    });

  let deleted = 0;
  for (const file of files) {
    if (file.date < cutoff) {
      fs.unlinkSync(path.join(BACKUP_DIR, file.name));
      console.log(`  Supprimé: ${file.name}`);
      deleted++;
    }
  }

  console.log(`\n✅ ${deleted} sauvegarde(s) supprimée(s)`);
}

// Point d'entrée
const args = process.argv.slice(2);

if (args.includes('--list')) {
  listBackups();
} else if (args.some(a => a.startsWith('--restore='))) {
  const filepath = args.find(a => a.startsWith('--restore=')).split('=')[1];
  restoreBackup(filepath);
} else if (args.some(a => a.startsWith('--clean='))) {
  const days = parseInt(args.find(a => a.startsWith('--clean=')).split('=')[1]);
  cleanOldBackups(days);
} else {
  createBackup();
}
