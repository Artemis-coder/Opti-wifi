import { type NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.DATABASE_URL || 'not set';
  // Extract host only
  const match = url.match(/@([^/:]+)/);
  const host = match ? match[1] : 'unknown';
  return NextResponse.json({
    db_host: host,
    vercel_env: process.env.VERCEL_ENV,
    node_env: process.env.NODE_ENV,
  });
}
