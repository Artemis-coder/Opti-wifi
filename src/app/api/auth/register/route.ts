import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Route POST pour créer un compte et une organisation avec le statut "pending_approval"
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, nom, orgName } = body;

    if (!email || !password || !nom || !orgName) {
      return NextResponse.json(
        { error: 'Veuillez remplir tous les champs obligatoires (Email, Mot de passe, Nom complet, Nom de l\'entreprise).' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères.' },
        { status: 400 }
      );
    }

    // Initialize Supabase Admin client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 1. Check if user already exists
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
    if (usersData && usersData.users) {
      const existingUser = usersData.users.find(u => u.email === email);
      if (existingUser) {
        return NextResponse.json(
          { error: 'Un compte existe déjà avec cette adresse email.' },
          { status: 400 }
        );
      }
    }

    // 2. Create the Organization with pending_approval status
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: orgName,
        email: email,
        contact_name: nom,
        status: 'pending_approval'
      })
      .select('id')
      .single();

    if (orgError || !orgData) {
      console.error('Organization creation error:', orgError);
      return NextResponse.json(
        { error: 'Erreur lors de la création de l\'entreprise.' },
        { status: 500 }
      );
    }

    // 3. Create the User via Admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: nom,
        role: 'administrateur'
      }
    });

    if (authError || !authData?.user) {
      // Rollback org creation if user creation fails
      await supabaseAdmin.from('organizations').delete().eq('id', orgData.id);
      console.error('User creation error:', authError);
      return NextResponse.json(
        { error: authError?.message || 'Erreur lors de la création de l\'utilisateur.' },
        { status: 500 }
      );
    }

    const userId = authData.user.id;

    // 4. Upsert Profile with organization ID
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        nom: nom,
        email: email,
        role: 'administrateur',
        organization_id: orgData.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // We don't rollback everything here to avoid orphaned auth users which are hard to delete without admin rights
      // The profile might have been created by a trigger, so we upsert it to ensure org_id is set.
    }

    return NextResponse.json({
      message: 'Compte créé avec succès. Votre compte est en attente de validation.',
      user: {
        id: userId,
        email,
        orgId: orgData.id
      }
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Register API unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Une erreur inattendue est survenue.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
