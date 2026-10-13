import { type NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifyToken, getUserById } from '@/lib/neon/auth';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ user: null });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ user: null });
  }

  const user = await getUserById(payload.sub);
  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ user });
}
