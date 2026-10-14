import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET() {
  try {
    const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
    const sql = neon(databaseUrl);
    
    // Extract host from URL
    const url = new URL(databaseUrl);
    const host = url.hostname;
    
    // Check schema
    const schema = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'conversation_sessions'`;
    
    // Check all tables
    const tables = await sql`SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    
    // Test query
    const result = await sql.query('SELECT * FROM conversation_sessions WHERE chat_id = $1', ['test123']);
    
    return NextResponse.json({ 
      ok: true, 
      databaseHost: host,
      schema: schema,
      tables: tables,
      queryResult: result
    });
  } catch (error) {
    console.error('Debug DB error:', error);
    return NextResponse.json({ ok: false, error: error.message, stack: error.stack });
  }
}
