/* eslint-disable @typescript-eslint/no-explicit-any */
import { NeonClient, TableBuilder } from './query-builder';
import { verifyToken, getUserById, NeonUser, AUTH_COOKIE_NAME } from './auth';
import type { SupabaseError, AuthUser } from './query-builder';

interface CookieHelpers {
  getAll: () => Array<{ name: string; value: string }>;
  setAll: (cookies: any[]) => void;
}

export interface ServerClientInstance {
  auth: {
    getUser: () => Promise<{ data: { user: AuthUser | null }; error: null }>;
    signOut: () => Promise<{ error: SupabaseError | null }>;
    signInWithPassword: (creds: { email: string; password: string }) => Promise<{ data: { user: AuthUser | null; session: any } | null; error: SupabaseError | null }>;
    updateUser: (attrs: any) => Promise<{ data: any; error: SupabaseError | null }>;
    setSession: (session: any) => Promise<{ data: any; error: SupabaseError | null }>;
    admin?: {
      listUsers: () => Promise<{ data: { users: AuthUser[] }; error: SupabaseError | null }>;
      createUser: (attrs: any) => Promise<{ data: { user: AuthUser | null }; error: SupabaseError | null }>;
      updateUserById: (userId: string, attrs: any) => Promise<{ data: any; error: SupabaseError | null }>;
      generateLink: (opts: any) => Promise<{ data: any; error: SupabaseError | null }>;
    };
  };
  from: (table: string) => TableBuilder;
  rpc: (name: string, params: Record<string, any>) => TableBuilder;
}

export function createServerClient(
  _url?: string,
  _key?: string,
  opts?: { cookies?: CookieHelpers }
): ServerClientInstance {
  let token: string | undefined;

  if (opts?.cookies) {
    const allCookies = opts.cookies.getAll();
    const found = allCookies.find((c: any) => c.name === AUTH_COOKIE_NAME);
    token = found?.value;
  }

  const payload = token ? verifyToken(token) : null;

  const client = new NeonClient(false);

  const auth = {
    getUser: async () => {
      if (!payload) return { data: { user: null }, error: null };
      const user = await getUserById(payload.sub);
      if (!user) return { data: { user: null }, error: null };
      return { data: { user: sessionToAuthUser(user) }, error: null };
    },
    signOut: async () => {
      return { error: null };
    },
    signInWithPassword: async (_creds: { email: string; password: string }) => {
      return { data: null, error: { message: 'Use /api/auth/login instead' } as SupabaseError };
    },
    updateUser: async (_attrs: any) => {
      return { data: null, error: null };
    },
    setSession: async () => {
      return { data: null, error: null };
    },
  };

  return {
    auth,
    from: (table: string): TableBuilder => client.from(table),
    rpc: (name: string, params: Record<string, any>): TableBuilder => client.rpc(name, params),
  };
}

export async function createServerAsyncClient(
  opts?: { cookies?: CookieHelpers }
): Promise<ServerClientInstance & { _user: NeonUser | null; _isPlatformAdmin: boolean }> {
  return createServerClient(undefined, undefined, opts) as any;
}

function sessionToAuthUser(user: NeonUser): AuthUser & { nom: string; role: string } {
  return {
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata || {},
    app_metadata: user.app_metadata || {},
    email_confirmed: user.email_confirmed,
    nom: user.nom || '',
    role: user.role,
    telephone: user.telephone || null,
    devise: user.devise || null,
    organization_id: user.organization_id || null,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export async function getPlatformUser(authUserId: string) {
  const result = await import('./db').then(m => m.query(
    `SELECT id, auth_user_id, role, full_name, email, is_active, last_login, created_at, updated_at
     FROM platform_users WHERE auth_user_id = $1 AND is_active = true`,
    [authUserId]
  ));

  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

export async function createPlatformAdminClient() {
  return createServerClient();
}

export type PlatformAuthResult =
  | { authenticated: true; platformUser: any }
  | { authenticated: false; error: string };

export async function getPlatformUserFromSession(): Promise<PlatformAuthResult> {
  const cookieStore = await (await import('next/headers')).cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return { authenticated: false, error: 'Not authenticated' };
  }

  const payload = verifyToken(token);
  if (!payload) {
    return { authenticated: false, error: 'Invalid token' };
  }

  const user = await getUserById(payload.sub);
  if (!user) {
    return { authenticated: false, error: 'User not found' };
  }

  const platformUser = await getPlatformUser(user.id);
  if (!platformUser || !platformUser.is_active) {
    return { authenticated: false, error: 'Not a platform user' };
  }

  return { authenticated: true, platformUser };
}

export async function requirePlatformAdmin() {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return { error: 'Non authentifié', status: 401 };

  const payload = verifyToken(token);
  if (!payload) return { error: 'Non authentifié', status: 401 };

  const user = await getUserById(payload.sub);
  if (!user) return { error: 'Non authentifié', status: 401 };

  const platformUser = await getPlatformUser(user.id);
  if (!platformUser || !platformUser.is_active || platformUser.role !== 'super_admin') {
    return { error: 'Accès refusé', status: 403 };
  }

  return { user, platformUser };
}

export type { CookieHelpers };
