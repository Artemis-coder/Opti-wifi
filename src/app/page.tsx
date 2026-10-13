import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export default async function RootPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(undefined, undefined, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: platformUser } = await supabase
    .from('platform_users')
    .select('role')
    .eq('auth_user_id', user.id)
    .single();

  if (platformUser && (platformUser.role === 'super_admin' || platformUser.role === 'platform_support')) {
    redirect('/platform/dashboard');
  }

  redirect('/dashboard');
}
