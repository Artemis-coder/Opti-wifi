import { type NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    DATABASE_URL: process.env.DATABASE_URL || 'not set',
    DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED || 'not set',
    NEON_DATABASE_URL: process.env.NEON_DATABASE_URL || 'not set',
    vercel_env: process.env.VERCEL_ENV,
    node_env: process.env.NODE_ENV,
  });
}

