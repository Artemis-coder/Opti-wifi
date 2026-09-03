import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createSuperAdmin() {
  try {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'superadmin@optiwifi.ci',
      password: 'Admin123!@#',
      email_confirm: true,
    });
    if (authError) throw authError;

    const uid = authData?.user?.id;
    if (!uid) throw new Error('No user ID returned');

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: uid,
        nom: 'Super Admin',
        email: 'superadmin@optiwifi.ci',
        role: 'administrateur',
      }, { onConflict: 'id' });
    if (profileError) throw profileError;

    const { error: puError } = await supabase
      .from('platform_users')
      .upsert({
        auth_user_id: uid,
        role: 'super_admin',
        full_name: 'Super Admin',
        email: 'superadmin@optiwifi.ci',
        is_active: true,
      }, { onConflict: 'auth_user_id' });
    if (puError) throw puError;

    console.log('Super admin account created successfully.');
    console.log('Email: superadmin@optiwifi.ci');
    console.log('Password: Admin123!@#');
    console.log('User ID:', uid);
  } catch (err) {
    if (err instanceof Error && err.message.includes('already exists')) {
      console.log('Account already exists. Updating...');
    } else {
      console.error('Error:', err instanceof Error ? err.message : err);
    }
  }
}

createSuperAdmin();
