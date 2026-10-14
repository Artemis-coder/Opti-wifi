/**
 * Conversation Memory - Persistent storage using Neon database
 */

import { query } from './neon/db';

interface ConversationMessage {
  id?: string;
  chat_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: any;
  tool_call_id?: string;
  metadata?: Record<string, any>;
  created_at?: Date;
}

interface ConversationSession {
  chat_id: string;
  model: string;
  transcription_model: string;
  context: string; // 'project', 'general', 'new_project', etc.
  auto_model: boolean;
  created_at: Date;
  updated_at: Date;
  message_count: number;
}

// Initialize conversation tables
export async function initConversationTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS conversation_sessions (
      chat_id VARCHAR(255) PRIMARY KEY,
      model VARCHAR(100) DEFAULT 'deepseek/deepseek-chat',
      transcription_model VARCHAR(100) DEFAULT 'openai/whisper-large-v3',
      context VARCHAR(50) DEFAULT 'general',
      auto_model BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      message_count INT DEFAULT 0
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS conversation_messages (
      id BIGSERIAL PRIMARY KEY,
      chat_id VARCHAR(255) NOT NULL REFERENCES conversation_sessions(chat_id),
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      tool_calls JSONB,
      tool_call_id VARCHAR(100),
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_conversation_messages_chat_id 
    ON conversation_messages(chat_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at 
    ON conversation_messages(created_at)
  `);
}

// Session management
export async function getOrCreateSession(chatId: string): Promise<ConversationSession> {
  const result = await query(
    'SELECT * FROM conversation_sessions WHERE chat_id = $1',
    [chatId]
  );

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  const newSession = await query(
    `INSERT INTO conversation_sessions (chat_id, model, transcription_model, context, auto_model)
     VALUES ($1, 'deepseek/deepseek-chat', 'openai/whisper-large-v3', 'general', true)
     RETURNING *`,
    [chatId]
  );

  return newSession.rows[0];
}

export async function updateSessionContext(chatId: string, context: string) {
  await query(
    `UPDATE conversation_sessions 
     SET context = $1, updated_at = NOW() 
     WHERE chat_id = $2`,
    [context, chatId]
  );
}

export async function updateSessionModel(chatId: string, model: string) {
  await query(
    `UPDATE conversation_sessions 
     SET model = $1, auto_model = false, updated_at = NOW() 
     WHERE chat_id = $2`,
    [model, chatId]
  );
}

export async function updateSessionTranscriptionModel(chatId: string, model: string) {
  await query(
    `UPDATE conversation_sessions 
     SET transcription_model = $1, updated_at = NOW() 
     WHERE chat_id = $2`,
    [model, chatId]
  );
}

// Message management
export async function addMessage(message: ConversationMessage) {
  const result = await query(
    `INSERT INTO conversation_messages 
     (chat_id, role, content, tool_calls, tool_call_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      message.chat_id,
      message.role,
      message.content,
      message.tool_calls ? JSON.stringify(message.tool_calls) : null,
      message.tool_call_id || null,
      message.metadata ? JSON.stringify(message.metadata) : null,
    ]
  );

  // Update session message count
  await query(
    `UPDATE conversation_sessions 
     SET message_count = message_count + 1, updated_at = NOW() 
     WHERE chat_id = $1`,
    [message.chat_id]
  );

  return result.rows[0];
}

export async function getConversationHistory(
  chatId: string, 
  limit: number = 20
): Promise<ConversationMessage[]> {
  const result = await query(
    `SELECT * FROM conversation_messages 
     WHERE chat_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2`,
    [chatId, limit]
  );

  return result.rows.reverse(); // Return in chronological order
}

export async function getRecentMessages(chatId: string, minutes: number = 60): Promise<ConversationMessage[]> {
  const result = await query(
    `SELECT * FROM conversation_messages 
     WHERE chat_id = $1 
     AND created_at > NOW() - INTERVAL '${minutes} minutes'
     ORDER BY created_at ASC`,
    [chatId]
  );

  return result.rows;
}

export async function clearConversationHistory(chatId: string) {
  await query(
    'DELETE FROM conversation_messages WHERE chat_id = $1',
    [chatId]
  );
  
  await query(
    `UPDATE conversation_sessions 
     SET message_count = 0, updated_at = NOW() 
     WHERE chat_id = $1`,
    [chatId]
  );
}

// Analytics
export async function getConversationStats(chatId: string) {
  const result = await query(
    `SELECT 
      COUNT(*) as total_messages,
      COUNT(*) FILTER (WHERE role = 'user') as user_messages,
      COUNT(*) FILTER (WHERE role = 'assistant') as assistant_messages,
      COUNT(*) FILTER (WHERE role = 'tool') as tool_messages,
      MIN(created_at) as first_message,
      MAX(created_at) as last_message
     FROM conversation_messages 
     WHERE chat_id = $1`,
    [chatId]
  );

  return result.rows[0];
}

// Search messages
export async function searchMessages(chatId: string, searchTerm: string, limit: number = 10) {
  const result = await query(
    `SELECT * FROM conversation_messages 
     WHERE chat_id = $1 
     AND content ILIKE $2
     ORDER BY created_at DESC 
     LIMIT $3`,
    [chatId, `%${searchTerm}%`, limit]
  );

  return result.rows;
}