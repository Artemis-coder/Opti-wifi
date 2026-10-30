import { adminClient } from '@/lib/neon/admin';
import { NextResponse } from 'next/server';
import { rejectTestEmailInProduction } from '@/lib/test-accounts';
import { notifyInBackground, notifySuperAdmins } from '@/lib/notifications';
import { rememberOrganizationCountry } from '@/lib/geo';
import { findCountry, formatInternationalPhone, isValidNationalNumber } from '@/lib/countries';

// Route POST pour créer un compte et une organisation avec le statut "pending_approval"
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, nom, orgName, country: countryCode, phone: nationalPhone } = body;

    if (!email || !password || !nom || !orgName) {
      return NextResponse.json(
        { error: 'Veuillez remplir tous les champs obligatoires (Email, Mot de passe, Nom complet, Nom de l\'entreprise).' },
        { status: 400 }
      );
    }

    // Téléphone international : pays choisi (drapeau) + numéro
    const country = findCountry(typeof countryCode === 'string' ? countryCode : '');
    if (!country || typeof nationalPhone !== 'string' || !isValidNationalNumber(nationalPhone)) {
      return NextResponse.json(
        { error: 'Numéro de téléphone invalide : choisissez le pays puis saisissez le numéro (6 à 14 chiffres).' },
        { status: 400 }
      );
    }
    const phone = formatInternationalPhone(country, nationalPhone);

    const testEmailError = rejectTestEmailInProduction(email);
    if (testEmailError) {
      return NextResponse.json({ error: testEmailError }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 8 caractères.' },
        { status: 400 }
      );
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = adminClient;

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
        phone,
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

    // Pays du compte (KPI « Top 3 des pays ») : celui choisi avec le téléphone
    await rememberOrganizationCountry(orgData.id, country.code);

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
        telephone: phone,
        organization_id: orgData.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // We don't rollback everything here to avoid orphaned auth users which are hard to delete without admin rights
      // The profile might have been created by a trigger, so we upsert it to ensure org_id is set.
    }

    notifyInBackground(() =>
      notifySuperAdmins({
        type: 'registration.new',
        title: 'Nouvelle inscription à valider',
        body: `${orgName} — ${nom} (${email})`,
        link: '/platform/registrations',
      })
    );

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
