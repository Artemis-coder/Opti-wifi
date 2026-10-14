import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function check() {
  try {
    const sessions = await sql`SELECT * FROM conversation_sessions`;
    console.log('Sessions:', sessions);
    
    const messages = await sql`SELECT * FROM conversation_messages ORDER BY created_at DESC LIMIT 10`;
    console.log('Messages:', messages);
  } catch (e) {
    console.error('Error:', e);
  }
}

check();
