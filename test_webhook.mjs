import { neon } from '@neondatabase/serverless';

const databaseUrl = "postgresql://neondb_owner:npg_eXQ0rhJs1Zum@ep-crimson-shape-ayvbw15x-pooler.c-5.us-east-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
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
