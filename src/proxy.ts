import { type NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, inspectNeonToken } from '@/lib/neon/jwt-edge';
import type { SecurityEventInput } from '@/lib/security-events';

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
  '/subscription',
  '/support',
  '/conditions-utilisation',
  '/commissions',
];

// Pages de gestion réservées à l'administrateur : le collecteur est renvoyé vers sa tournée.
// (Simple confort de navigation : les données restent protégées côté serveur.)
const ADMIN_ONLY_ROUTES = ['/spaces', '/tickets', '/users', '/reports', '/subscription'];

// Compte « point de vente » (consultation seule) : seules ces pages lui sont ouvertes.
const POS_ACCOUNT_ROUTES = ['/dashboard', '/allocations', '/collections', '/commissions', '/settings', '/support', '/conditions-utilisation', '/notifications'];
// Pages propres au compte point de vente : les autres rôles sont renvoyés à leur accueil.
const POS_ACCOUNT_ONLY_ROUTES = ['/commissions'];
// … sauf les pages de saisie.
const POS_ACCOUNT_BLOCKED_ROUTES = ['/allocations/new', '/allocations/exchange', '/collections/new'];

const CSRF_EXEMPT_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/reset-password',
  '/api/auth/set-password',
  '/api/telegram/ai-webhook-v2',
  '/api/telegram/notify',
  '/api/telegram/test',
  '/api/telegram/vercel',
  '/api/cron/health-check',
  '/api/ai/notify',
  // Webhook SasPay : authentifié par signature HMAC (src/lib/saspay/webhook.ts)
  '/api/webhooks/saspay',
];

// Fichiers et outils que les robots d'attaque cherchent : jamais présents ici. Réponse 404 et signalement.
const SCAN_PATTERN =
  /(^|\/)\.(env|git|svn|hg|aws|ssh|htaccess|htpasswd|ds_store|npmrc|docker)(\/|$|\.|[a-z_-])|\/wp-(admin|login|content|includes|config)|xmlrpc\.php|phpmyadmin|\/pma\/|\.php\d?$|\/cgi-bin\/|\/vendor\/phpunit|\/actuator(\/|$)|\/server-status|\/config\.(json|ya?ml)$|\/(backup|dump|database)\.(sql|zip|tar|gz)$|\/etc\/passwd|\.\.\/|%2e%2e/i;

/** Signalement en arrière-plan (module chargé seulement quand il y a quelque chose à signaler). */
function report(input: SecurityEventInput) {
  void import('@/lib/security-events').then(({ reportSecurityEvent }) => reportSecurityEvent(input)).catch(() => {});
}

function isCSRFExempt(pathname: string): boolean {
  return CSRF_EXEMPT_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'));
}

function checkCSRF(request: NextRequest): boolean {
  const method = request.method;
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  const host = request.headers.get('host');
  // Origine illisible (ex. « null » d'une iframe isolée) : refusée au lieu de faire planter le proxy
  const sameHost = (value: string) => {
    try {
      return new URL(value).host === host;
    } catch {
      return false;
    }
  };
  if (origin && !sameHost(origin)) return false;
  if (referer && !sameHost(referer)) return false;

  return true;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Scan de fichiers sensibles (.env, .git, wp-admin…) : 404 et alerte
  if (SCAN_PATTERN.test(pathname) || SCAN_PATTERN.test(request.nextUrl.search)) {
    report({ type: 'path_scan', request, detail: `${request.method} ${pathname}${request.nextUrl.search}`.slice(0, 300) });
    return new NextResponse('Not found', { status: 404 });
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const inspected = token ? await inspectNeonToken(token) : null;
  const user = inspected?.payload ?? null;
  // Signature fausse ou jeton mal formé (une session simplement expirée n'est pas signalée)
  if (inspected?.state === 'invalid') {
    report({ type: 'forged_token', request, detail: `Cookie de session à la signature invalide sur ${pathname}` });
  }

  // Compte connecté qui n'est pas super admin et appelle les API du back-office
  if (
    pathname.startsWith('/api/platform/') && user &&
    user.role !== 'super_admin' && user.app_metadata?.role !== 'super_admin'
  ) {
    report({ type: 'admin_probe', request, userId: user.sub, identifier: user.email, detail: `${request.method} ${pathname}` });
  }

  // CSRF protection for state-changing requests
  if (!isCSRFExempt(pathname)) {
    if (!checkCSRF(request)) {
      report({
        type: 'csrf_blocked',
        request,
        userId: user?.sub ?? null,
        detail: `Origine : ${request.headers.get('origin') || request.headers.get('referer') || 'inconnue'}`,
      });
      return NextResponse.json(
        { error: 'CSRF validation failed' },
        { status: 403 }
      );
    }
  }

  // --- Mot de passe temporaire : changement obligatoire avant tout accès ---
  if (pathname === '/change-password') {
    return user ? NextResponse.next() : NextResponse.redirect(new URL('/login', request.url));
  }
  if (user?.app_metadata?.must_change_password === true) {
    const allowedApi = ['/api/auth/change-password', '/api/auth/logout', '/api/auth/session', '/api/auth/login'];
    if (pathname.startsWith('/api/')) {
      if (allowedApi.includes(pathname)) return NextResponse.next();
      return NextResponse.json(
        { error: 'Changement de mot de passe requis.', code: 'PASSWORD_CHANGE_REQUIRED' },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL('/change-password', request.url));
  }

  const isClientRoute = PROTECTED_CLIENT_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  const isPlatformRoute =
    pathname === '/platform' || pathname.startsWith('/platform/');

  const isAuthRoute = pathname.startsWith('/login') || pathname === '/';

  // --- Platform back-office routes ---
  // Page de connexion unique (/login) : le back-office n'a plus sa propre page de connexion.
  if (isPlatformRoute) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    const isSuperAdmin =
      user.role === 'super_admin' || user.app_metadata?.role === 'super_admin';
    if (!isSuperAdmin) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (pathname === '/platform' || pathname === '/platform/login') {
      return NextResponse.redirect(new URL('/platform/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // --- Client app routes ---
  // Utilisateur déjà connecté sur / ou /login : le super admin va au back-office, les clients à leur espace.
  if (user && isAuthRoute) {
    const isSuperAdmin =
      user.role === 'super_admin' || user.app_metadata?.role === 'super_admin';
    return NextResponse.redirect(new URL(isSuperAdmin ? '/platform/dashboard' : '/dashboard', request.url));
  }

  if (isClientRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Le super admin n'accède pas aux espaces clients : il reste dans le back-office
  if (isClientRoute && (user?.role === 'super_admin' || user?.app_metadata?.role === 'super_admin')) {
    return NextResponse.redirect(new URL('/platform/dashboard', request.url));
  }

  if (
    user?.role === 'point_de_vente' &&
    isClientRoute &&
    (!POS_ACCOUNT_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/')) ||
      POS_ACCOUNT_BLOCKED_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/')))
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (
    user?.role !== 'point_de_vente' &&
    POS_ACCOUNT_ONLY_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (
    user?.role === 'collecteur' &&
    ADMIN_ONLY_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|ingest|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|css|js|woff2|ttf|eot)$).*)',
  ],
};