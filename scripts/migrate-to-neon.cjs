#!/usr/bin/env node

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

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
  'organizations',
  'profiles',
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

function splitSqlStatements(sqlText) {
  const statements = [];
  let current = '';
  let i = 0;
  const len = sqlText.length;
  let inDollarQuote = false;
  let dollarTag = '';
  let inLineComment = false;
  let inBlockComment = false;

  while (i < len) {
    const ch = sqlText[i];
    const twoCh = sqlText.slice(i, i + 2);

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      i++;
      continue;
    }

    if (inBlockComment) {
      if (twoCh === '*/') { inBlockComment = false; i += 2; continue; }
      i++;
      continue;
    }

    if (inDollarQuote) {
      const closing = '$' + dollarTag + '$';
      if (sqlText.slice(i, i + dollarTag.length + 2) === closing) {
        current += closing;
        inDollarQuote = false;
        dollarTag = '';
        i += dollarTag.length + 2;
        continue;
      }
      current += ch;
      i++;
      continue;
    }

    if (twoCh === '--') { inLineComment = true; i += 2; continue; }
    if (twoCh === '/*') { inBlockComment = true; i += 2; continue; }

    if (ch === '$') {
      let tagEnd = i + 1;
      while (tagEnd < len && sqlText[tagEnd] !== '$' && sqlText[tagEnd] !== '\n' && sqlText[tagEnd] !== ' ' && sqlText[tagEnd] !== '\t') {
        tagEnd++;
      }
      if (tagEnd < len && sqlText[tagEnd] === '$') {
        const tag = sqlText.slice(i + 1, tagEnd);
        inDollarQuote = true;
        dollarTag = tag;
        current += sqlText.slice(i, tagEnd + 1);
        i = tagEnd + 1;
        continue;
      }
    }

    if (ch === ';') {
      statements.push(current.trim());
      current = '';
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  if (current.trim().length > 0) {
    statements.push(current.trim());
  }

  return statements.filter(s => s.length > 0);
}

async function executeSchema() {
  console.log('Resetting schema...');
  try { await sql`DROP SCHEMA public CASCADE`; } catch (e) { }
  await sql`CREATE SCHEMA public`;
  console.log('Schema reset complete.\n');

  const schema = fs.readFileSync(SCHEMA_FILE, 'utf-8');
  const statements = splitSqlStatements(schema);
  console.log('Executing ' + statements.length + ' schema statements...');
  let successCount = 0;
  let errorCount = 0;
  for (const stmt of statements) {
    try {
      await sql.query(stmt);
      successCount++;
    } catch (err) {
      if (err.message && (err.message.includes('already exists') || err.message.includes('duplicate'))) {
        successCount++;
      } else {
        errorCount++;
        console.error('Schema error: ' + stmt.trim().split('\n')[0].slice(0, 80) + '...');
        console.error('  ' + (err.message ? err.message.slice(0, 200) : String(err).slice(0, 200)));
      }
    }
  }
  console.log('Schema executed: ' + successCount + ' OK, ' + errorCount + ' errors\n');
}

async function getTableColumns(tableName) {
  const result = await sql.query(
    "SELECT column_name, data_type, is_generated FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
    [tableName]
  );
  const cols = {};
  for (const row of result) {
    cols[row.column_name] = {
      data_type: row.data_type,
      is_generated: row.is_generated === 'ALWAYS' || row.is_generated === 'STORED' || row.is_generated === 'VIRTUAL',
    };
  }
  return cols;
}

async function getPrimaryKey(tableName) {
  const result = await sql.query(
    "SELECT column_name FROM information_schema.key_column_usage WHERE table_schema = 'public' AND table_name = $1 AND constraint_name LIKE '%_pkey' ORDER BY ordinal_position LIMIT 1",
    [tableName]
  );
  return result.length > 0 ? result[0].column_name : 'id';
}

function escapeSql(str) {
  return String(str).replace(/'/g, "''");
}

function formatJsonValue(v, dataType) {
  if (dataType && (dataType === 'json' || dataType === 'jsonb')) {
    if (typeof v === 'string') {
      // Could be JSON string or plain string
      try {
        JSON.parse(v);
        return "'" + escapeSql(v) + "'";
      } catch (e) {
        // Not valid JSON, wrap as JSON string
        return "'" + escapeSql(JSON.stringify(v)) + "'";
      }
    }
    if (typeof v === 'number') return "'" + v.toString() + "'";
    if (typeof v === 'boolean') return "'" + (v ? 'true' : 'false') + "'";
    if (Array.isArray(v) || (typeof v === 'object' && v !== null)) {
      return "'" + escapeSql(JSON.stringify(v)) + "'";
    }
    return "'" + escapeSql(JSON.stringify(String(v))) + "'";
  }
  // Non-JSON columns
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'string') return "'" + escapeSql(v) + "'";
  if (typeof v === 'number') return v.toString();
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v) || (typeof v === 'object' && v !== null)) {
    return "'" + escapeSql(JSON.stringify(v)) + "'";
  }
  return "'" + escapeSql(String(v)) + "'";
}

async function migrateTable(tableName, rows) {
  if (!rows || rows.length === 0) {
    console.log('  ' + tableName + ': 0 records (skipped)');
    return;
  }

  let dbColumns = null;
  let pkColumn = 'id';
  try {
    dbColumns = await getTableColumns(tableName);
    pkColumn = await getPrimaryKey(tableName);
  } catch (e) {
    console.error('  ' + tableName + ': could not fetch columns: ' + (e.message || String(e)).slice(0, 100));
    console.log('  ' + tableName + ': ' + rows.length + ' records (all skipped)');
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  let skippedRows = 0;

  for (const row of rows) {
    const rowColumns = Object.keys(row);

    const insertableCols = rowColumns.filter(function(col) {
      if (!dbColumns[col]) return false;
      if (dbColumns[col].is_generated) return false;
      return true;
    });

    if (insertableCols.length === 0) {
      skippedRows++;
      continue;
    }

    const colNames = insertableCols.map(c => '"' + c + '"').join(', ');
    const vals = insertableCols.map(c => formatJsonValue(row[c], dbColumns[c].data_type)).join(', ');

    try {
      await sql.query('INSERT INTO "' + tableName + '" (' + colNames + ') VALUES (' + vals + ')');
      successCount++;
    } catch (err) {
      if (err.message && err.message.includes('duplicate key')) {
        const updates = insertableCols.filter(c => c !== pkColumn).map(c => {
          return '"' + c + '" = ' + formatJsonValue(row[c], dbColumns[c].data_type);
        }).join(', ');
        if (updates.length > 0) {
          try {
            const pkVal = row[pkColumn];
            await sql.query('UPDATE "' + tableName + '" SET ' + updates + ' WHERE "' + pkColumn + '" = ' + formatJsonValue(pkVal, dbColumns[pkColumn] ? dbColumns[pkColumn].data_type : undefined));
            successCount++;
          } catch (e2) {
            errorCount++;
            console.error('    Update error on row ' + (row[pkColumn] || 'unknown') + ': ' + (e2.message || String(e2)).slice(0, 150));
          }
        }
      } else if (err.message && (err.message.includes('NOT NULL') || err.message.includes('foreign key'))) {
        skippedRows++;
        console.error('    Skipping row ' + (row[pkColumn] || 'unknown') + ': ' + (err.message ? err.message.slice(0, 80) : 'constraint error'));
      } else {
        errorCount++;
        console.error('    Error on row ' + (row[pkColumn] || 'unknown') + ': ' + (err.message ? err.message.slice(0, 150) : String(err).slice(0, 150)));
      }
    }
  }
  console.log('  ' + tableName + ': ' + successCount + ' inserted, ' + errorCount + ' errors, ' + skippedRows + ' skipped (' + rows.length + ' total)');
}

async function migrateUsers(data, rows) {
  if (!rows || rows.length === 0) {
    console.log('  users: 0 records (skipped)');
    return;
  }

  for (const row of rows) {
    const email = row.email;
    const passwordHash = row.password_hash || '$2b$10$dummy_hash_placeholder';
    const emailConfirmed = row.email_confirmed === true;
    const userMetadata = JSON.stringify(row.user_metadata || { nom: row.nom, role: row.role, telephone: row.telephone, organization_id: row.organization_id });
    const appMetadata = JSON.stringify(row.app_metadata || { role: row.role || 'administrateur' });
    const id = row.id;
    const createdAt = row.created_at || new Date().toISOString();
    const updatedAt = row.updated_at || new Date().toISOString();

    try {
      await sql.query(
        "INSERT INTO users (id, email, password_hash, email_confirmed, user_metadata, app_metadata, created_at, updated_at) " +
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8) " +
        "ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash, email_confirmed = EXCLUDED.email_confirmed, user_metadata = EXCLUDED.user_metadata, app_metadata = EXCLUDED.app_metadata",
        [id, email, passwordHash, emailConfirmed, userMetadata, appMetadata, createdAt, updatedAt]
      );
    } catch (err) {
      console.error('    Error on user ' + id + ': ' + (err.message ? err.message.slice(0, 100) : String(err).slice(0, 100)));
    }
  }
  console.log('  users: ' + rows.length + ' records inserted');
}

async function main() {
  console.log('=== Starting Neon Data Migration ===\n');

  console.log('Step 1: Executing schema...');
  await executeSchema();

  console.log('Step 2: Loading backup data...');
  const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf-8'));
  console.log('  Backup created at: ' + backup.created_at + '\n');

  console.log('Backup tables:', Object.keys(backup.tables));

  console.log('\nStep 3: Migrating users...');
  const authUsers = backup.tables.users || backup.tables.auth_users || [];
  if (authUsers.length === 0) {
    const profiles = backup.tables.profiles || [];
    console.log('  No auth.users table found. Creating users from profiles...');
    for (const profile of profiles) {
      const userId = profile.id;
      const email = profile.email;
      const passwordHash = '$2b$10$dummy_hash_placeholder';
      const role = profile.role || 'administrateur';
      const userMetadata = JSON.stringify({
        nom: profile.nom,
        role: role,
        telephone: profile.telephone,
        organization_id: profile.organization_id
      });
      const appMetadata = JSON.stringify({ role: role });

      try {
        await sql.query(
          "INSERT INTO users (id, email, password_hash, email_confirmed, user_metadata, app_metadata, created_at, updated_at) " +
          "VALUES ($1, $2, $3, $4, $5, $6, $7, $8) " +
          "ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash, email_confirmed = EXCLUDED.email_confirmed, user_metadata = EXCLUDED.user_metadata, app_metadata = EXCLUDED.app_metadata",
          [userId, email, passwordHash, true, userMetadata, appMetadata, profile.created_at || new Date().toISOString(), profile.updated_at || new Date().toISOString()]
        );
      } catch (err) {
        console.error('    Error on user ' + userId + ': ' + (err.message ? err.message.slice(0, 100) : String(err).slice(0, 100)));
      }
    }
    console.log('  users: ' + profiles.length + ' records created from profiles');
  } else {
    await migrateUsers(backup, authUsers);
  }

  console.log('\nStep 4: Migrating tables...');
  for (const tableName of TABLE_ORDER) {
    if (tableName === 'users') continue;
    const rows = backup.tables[tableName] || [];
    await migrateTable(tableName, rows);
  }

  console.log('\n=== Migration Complete ===\n');

  console.log('Step 5: Verifying data...');
  for (const tableName of TABLE_ORDER) {
    const result = await sql.query('SELECT COUNT(*) as count FROM "' + tableName + '"');
    console.log('  ' + tableName + ': ' + (result[0] ? result[0].count : 0) + ' rows');
  }

  process.exit(0);
}

main().catch(function(err) {
  console.error('Migration failed:', err);
  process.exit(1);
});
