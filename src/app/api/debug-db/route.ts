import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET() {
  try {
    const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
    const sql = neon(databaseUrl);
    
    // Check schema
    const schema = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'conversation_sessions'`;
    
    // Test query
    const result = await sql.query('SELECT * FROM conversation_sessions WHERE chat_id = $1', ['test123']);
    
    return NextResponse.json({ 
      ok: true, 
      databaseUrl: databaseUrl ? 'SET' : 'NOT SET',
      schema: schema,
      queryResult: result
    });
  } catch (error) {
    console.error('Debug DB error:', error);
    return NextResponse.json({ ok: false, error: error.message, stack: error.stack });
  }
}
