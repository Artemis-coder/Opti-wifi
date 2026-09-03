import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

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
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll().map(c => ({
            name: c.name,
            value: c.value,
          }));
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({
              name,
              value,
              ...options,
            });
          });
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set({
              name,
              value,
              ...options,
            });
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isClientRoute =
    PROTECTED_CLIENT_ROUTES.some(route =>
      pathname === route || pathname.startsWith(route + '/')
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
      // allow access to login page without user session
      if (isPlatformLogin) {
        return supabaseResponse;
      }
      // Redirect /platform to /platform/login
      return NextResponse.redirect(new URL('/platform/login', request.url));
    }

    if (user && isPlatformLogin) {
      // Check if user is a platform super admin
      const { data: platformUser, error } = await supabase
        .from('platform_users')
        .select('role, is_active')
        .eq('auth_user_id', user.id)
        .single();

      if (error || !platformUser || !platformUser.is_active) {
        // Not a platform user — redirect to client dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }

      // Valid platform login — send to dashboard
      return NextResponse.redirect(new URL('/platform/dashboard', request.url));
    }

    if (user && !isPlatformLogin) {
      // Verify platform user access
      const { data: platformUser, error } = await supabase
        .from('platform_users')
        .select('role, is_active')
        .eq('auth_user_id', user.id)
        .single();

      if (error || !platformUser || !platformUser.is_active) {
        // Not authorized for platform — redirect to client dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    if (!user && !isPlatformLogin) {
      return NextResponse.redirect(new URL('/platform/login', request.url));
    }

    return supabaseResponse;
  }

  // --- Client app routes ---
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (isClientRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|css|js|woff2|ttf|eot)$).*)',
  ],
};
