import { NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/conversation-memory';

export async function GET() {
  try {
    const session = await getOrCreateSession('test123');
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    console.error('Test DB error:', error);
    return NextResponse.json({ ok: false, error: error.message });
  }
}
