import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { PlatformUser } from '@/types/platform';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Supabase environment variables are not configured. ' +
    'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
  );
}

export async function createPlatformAdminClient() {
  const cookieStore = await cookies();

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

export type PlatformAuthResult =
  | { authenticated: true; platformUser: PlatformUser }
  | { authenticated: false; error: string };

export async function getPlatformUserFromSession(): Promise<PlatformAuthResult> {
  const supabase = await createPlatformAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { authenticated: false, error: 'Not authenticated' };
  }

  const { data: platformUser, error } = await supabase
    .from('platform_users')
    .select('*')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .single();

  if (error || !platformUser) {
    return { authenticated: false, error: 'Not a platform user' };
  }

  return { authenticated: true, platformUser: platformUser as unknown as PlatformUser };
}
