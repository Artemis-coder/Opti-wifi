import { type NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/neon/auth';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });

  response.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
