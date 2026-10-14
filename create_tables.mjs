import { neon } from '@neondatabase/serverless';

// Use the DATABASE_URL from Vercel production environment
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function init() {
  await sql`CREATE TABLE IF NOT EXISTS conversation_sessions (
    chat_id VARCHAR(255) PRIMARY KEY,
    model VARCHAR(100) DEFAULT 'deepseek/deepseek-chat',
    transcription_model VARCHAR(100) DEFAULT 'openai/whisper-large-v3',
    context VARCHAR(50) DEFAULT 'general',
    auto_model BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    message_count INT DEFAULT 0
  )`;
  
  await sql`CREATE TABLE IF NOT EXISTS conversation_messages (
    id BIGSERIAL PRIMARY KEY,
    chat_id VARCHAR(255) NOT NULL REFERENCES conversation_sessions(chat_id),
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    tool_calls JSONB,
    tool_call_id VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  )`;
  
  await sql`CREATE TABLE IF NOT EXISTS bot_learned_facts (
    id BIGSERIAL PRIMARY KEY,
    chat_id VARCHAR(255) NOT NULL,
    fact TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    importance INT DEFAULT 5,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(chat_id, fact)
  )`;
  
  await sql`CREATE TABLE IF NOT EXISTS bot_user_preferences (
    id BIGSERIAL PRIMARY KEY,
    chat_id VARCHAR(255) NOT NULL,
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(chat_id, key)
  )`;
  
  await sql`CREATE TABLE IF NOT EXISTS bot_interactions (
    id BIGSERIAL PRIMARY KEY,
    chat_id VARCHAR(255) NOT NULL,
    user_message TEXT NOT NULL,
    bot_response TEXT,
    tools_used JSONB,
    success BOOLEAN DEFAULT true,
    context VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP DEFAULT NOW()
  )`;
  
  console.log('Tables created in production database');
}

init().catch(console.error);
