import { neon } from '@neondatabase/serverless';

// Jamais d'adresse de base en dur : lue depuis l'environnement (base dev uniquement)
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL manquant (lancer avec : node --env-file=.env.local test_webhook.mjs)');
if (databaseUrl.includes('ep-flat-term')) throw new Error('Refus : script de test interdit sur la base de production');
const sql = neon(databaseUrl);

// Simulate getOrCreateSession
async function getOrCreateSession(chatId) {
  try {
    const result = await sql`SELECT * FROM conversation_sessions WHERE chat_id = ${chatId}`;
    console.log('Select result:', result);
    
    if (result.length > 0) {
      return result[0];
    }

    const newSession = await sql`
      INSERT INTO conversation_sessions (chat_id, model, transcription_model, context, auto_model)
      VALUES (${chatId}, 'deepseek/deepseek-chat', 'openai/whisper-large-v3', 'general', true)
      RETURNING *
    `;
    console.log('Insert result:', newSession);
    return newSession[0];
  } catch (e) {
    console.error('Error in getOrCreateSession:', e);
    throw e;
  }
}

await getOrCreateSession('1898085750');
