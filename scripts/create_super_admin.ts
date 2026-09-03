import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function createSuperAdmin() {
  const email = 'kedakeyaoboris@gmail.com';
  const password = '20071995@94119427';

  try {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Super Admin' },
    });
    if (authError) throw authError;

    const uid = authData?.user?.id ?? (await supabase.auth.admin.getUserByEmail(email)).data?.user?.id;
    if (!uid) throw new Error('No user ID returned');

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: uid,
        nom: 'Super Admin',
        email,
        role: 'administrateur',
      }, { onConflict: 'id' });
    if (profileError) throw profileError;

    const { error: puError } = await supabase
      .from('platform_users')
      .upsert({
        auth_user_id: uid,
        role: 'super_admin',
        full_name: 'Super Admin',
        email,
        is_active: true,
      }, { onConflict: 'auth_user_id' });
    if (puError) throw puError;

    console.log('Super admin account ready:', email);
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : err);
  }
}

createSuperAdmin();
