import { type NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifyNeonToken } from '@/lib/neon/jwt-edge';

const PROTECTED_CLIENT_ROUTES = [
  '/dashboard',
  '/pos',
  '/collections',
  '/tickets',
  '/allocations',
  '/spaces',
  '/users',
  '/reports',
  '/settings',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = token ? await verifyNeonToken(token) : null;

  const isClientRoute = PROTECTED_CLIENT_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  const isPlatformRoute =
    pathname === '/platform' || pathname.startsWith('/platform/');

  const isAuthRoute = pathname.startsWith('/login') || pathname === '/';

  // --- Platform back-office routes ---
  if (isPlatformRoute) {
    const isPlatformLogin = pathname === '/platform/login';
    const isPlatformRoot = pathname === '/platform';

    // Redirect root to login if no session
    if (!user && (isPlatformLogin || isPlatformRoot)) {
      if (isPlatformLogin) {
        return NextResponse.next();
      }
      return NextResponse.redirect(new URL('/platform/login', request.url));
    }

    if (user && isPlatformLogin) {
      const isSuperAdmin =
        user.role === 'super_admin' || user.app_metadata?.role === 'super_admin';
      if (!isSuperAdmin) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
      return NextResponse.redirect(new URL('/platform/dashboard', request.url));
    }

    if (user && !isPlatformLogin) {
      const isSuperAdmin =
        user.role === 'super_admin' || user.app_metadata?.role === 'super_admin';
      if (!isSuperAdmin) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    if (!user && !isPlatformLogin) {
      return NextResponse.redirect(new URL('/platform/login', request.url));
    }

    return NextResponse.next();
  }

  // --- Client app routes ---
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (isClientRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|css|js|woff2|ttf|eot)$).*)',
  ],
};
