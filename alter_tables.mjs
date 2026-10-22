import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const PROD_HOST = 'ep-flat-term-aymd9rhb';
if (databaseUrl.includes(PROD_HOST) && process.env.CONFIRM_PROD !== 'yes') {
  console.error('⚠️ [GUARDRAIL] DATABASE_URL pointe vers la base de données Neon de PRODUCTION.');
  console.error('Pour exécuter ce script sur la production, définissez explicitement CONFIRM_PROD=yes.');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function alter() {
  try {
    // Add missing columns to conversation_sessions
    await sql`ALTER TABLE conversation_sessions ADD COLUMN IF NOT EXISTS transcription_model VARCHAR(100) DEFAULT 'openai/whisper-large-v3'`;
    console.log('Added transcription_model column');
    
    await sql`ALTER TABLE conversation_sessions ADD COLUMN IF NOT EXISTS auto_model BOOLEAN DEFAULT true`;
    console.log('Added auto_model column');
    
    // Verify
    const schema = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'conversation_sessions'`;
    console.log('Schema:', schema);
  } catch (e) {
    console.error('Error:', e);
  }
}

alter();
