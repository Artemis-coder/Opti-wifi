#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL or NEON_DATABASE_URL is required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const BACKUP_FILE = path.join(process.cwd(), 'scripts', 'backups', 'backup-2026-10-13T00-04-30-916Z.json');
const SCHEMA_FILE = path.join(process.cwd(), 'supabase', 'neon_schema.sql');

const TABLE_ORDER = [
  'users',
  'profiles',
  'organizations',
  'wifi_spaces',
  'points_of_sale',
  'ticket_types',
  'ticket_allocations',
  'collections',
  'collection_items',
  'subscription_plans',
  'subscriptions',
  'payments',
  'invoices',
  'audit_logs',
  'platform_users',
  'platform_audit_logs',
  'platform_settings',
  'support_tickets',
];

async function executeSchema() {
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf-8');
  const statements = schema.split(';').filter(s => s.trim().length > 0);
  console.log(`Executing ${statements.length} schema statements...`);
  for (const stmt of statements) {
    try {
      await sql([stmt]);
    } catch (err: { message?: string }) {
      if (err instanceof Error ? err.message : String(err)('already exists')) {
        console.log(`  (already exists) ${stmt.trim().split('\n')[0].slice(0, 60)}...`);
      } else {
        console.error(`Schema error: ${stmt.trim().split('\n')[0].slice(0, 60)}...`);
        console.error(err.message?.slice(0, 200));
      }
    }
  }
  console.log('Schema executed.\n');
}

function toSqlValue(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val)}'`;
}

async function migrateTable(tableName: string, rows: Record<string, unknown>[]) {
  if (!rows || rows.length === 0) {
    console.log(`  ${tableName}: 0 records (skipped)`);
    return;
  }

  const columns = Object.keys(rows[0]);
  
  for (const row of rows) {
    const values = columns.map(col => toSqlValue(row[col]));
    const colsSql = columns.map(c => `"${c}"`).join(', ');
    const valsSql = values.join(', ');
    try {
      await sql([`INSERT INTO "${tableName}" (${colsSql}) VALUES (${valsSql})`]);
    } catch (err: { message?: string }) {
      if (err instanceof Error ? err.message : String(err)('duplicate key')) {
        await sql([`UPDATE "${tableName}" SET ${columns.map(c => `"${c}" = ${toSqlValue(row[c])}`).filter((_, i) => c !== 'id').join(', ')} WHERE id = '${row.id}'`]);
      } else {
        console.error(`    Error on row ${row.id}:`, err.message?.slice(0, 100));
      }
    }
  }
  console.log(`  ${tableName}: ${rows.length} records inserted`);
}

async function migrateUsers(data: Record<string, unknown>, rows: Record<string, unknown>[]) {
  if (!rows || rows.length === 0) {
    console.log(`  users: 0 records (skipped)`);
    return;
  }

  for (const row of rows) {
    const email = row.email;
    const passwordHash = row.password_hash || '$2b$10$dummy_hash_placeholder';
    const emailConfirmed = row.email_confirmed ?? true;
    const userMetadata = row.user_metadata || { nom: row.nom, role: row.role, telephone: row.telephone, organization_id: row.organization_id };
    const appMetadata = row.app_metadata || { role: row.role || 'administrateur' };

    await sql([`
      INSERT INTO users (id, email, password_hash, email_confirmed, user_metadata, app_metadata, created_at, updated_at)
      VALUES ('${row.id}', '${String(email).replace(/'/g, "''")}', '${String(passwordHash).replace(/'/g, "''")}', ${emailConfirmed}, '${JSON.stringify(userMetadata).replace(/'/g, "''")}', '${JSON.stringify(appMetadata).replace(/'/g, "''")}', '${row.created_at || new Date().toISOString()}', '${row.updated_at || new Date().toISOString()}')
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        email_confirmed = EXCLUDED.email_confirmed,
        user_metadata = EXCLUDED.user_metadata,
        app_metadata = EXCLUDED.app_metadata
    `]);
  }
  console.log(`  users: ${rows.length} records inserted`);
}

async function main() {
  console.log('=== Starting Neon Data Migration ===\n');

  // Step 1: Execute schema
  console.log('Step 1: Executing schema...');
  await executeSchema();

  // Step 2: Load backup data
  console.log('Step 2: Loading backup data...');
  const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf-8'));
  console.log(`  Backup created at: ${backup.created_at}\n`);

  // Step 3: Migrate users (from auth.users)
  console.log('Step 3: Migrating users...');
  const authUsers = backup.tables.users || [];
  await migrateUsers(backup, authUsers);

  // Step 4: Migrate all tables
  console.log('\nStep 4: Migrating tables...');
  for (const tableName of TABLE_ORDER) {
    if (tableName === 'users') continue;
    const rows = backup.tables[tableName] || [];
    await migrateTable(tableName, rows);
  }

  console.log('\n=== Migration Complete ===\n');

  // Step 5: Verify data
  console.log('Step 5: Verifying data...');
  for (const tableName of TABLE_ORDER) {
    const result = await sql([`SELECT COUNT(*) as count FROM "${tableName}"`]);
    console.log(`  ${tableName}: ${result[0]?.count || 0} rows`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
