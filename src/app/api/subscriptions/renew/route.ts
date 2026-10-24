import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

function getBillingPeriodMonths(period: string): number {
  switch (period) {
    case 'monthly':
      return 1;
    case 'quarterly':
      return 3;
    case 'semiannual':
      return 6;
    case 'annual':
      return 12;
    default:
      return 1;
  }
}

async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(undefined, undefined, {
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
  });
}

async function getCurrentSubscription(supabase: any, user: any) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id) return { subscription: null, error: 'Aucune organisation associée' };

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select('*, plan:subscription_plans(*)')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return { subscription, error };
}

export async function GET(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { subscription, error } = await getCurrentSubscription(supabase, user);

  if (error || !subscription) {
    return NextResponse.json({ error: error || 'Abonnement introuvable' }, { status: 404 });
  }

  const durationMonths = getBillingPeriodMonths(subscription.plan?.billing_period || 'monthly');

  return NextResponse.json({
    success: true,
    data: {
      subscription,
      durationMonths,
      canRenew: true,
    },
  });
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { subscription, error } = await getCurrentSubscription(supabase, user);

  if (error || !subscription) {
    return NextResponse.json({ error: error || 'Abonnement introuvable' }, { status: 404 });
  }

  const durationMonths = getBillingPeriodMonths(subscription.plan?.billing_period || 'monthly');
  const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
  const newEndDate = new Date(Date.now() + durationMonths * oneMonthMs);

  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      start_date: new Date().toISOString(),
      end_date: newEndDate.toISOString(),
      cancel_at_period_end: false,
      cancelled_at: null,
      auto_renew: true,
    })
    .eq('id', subscription.id);

  if (updateError) {
    console.error('Subscription renew error:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Abonnement renouvelé avec succès',
    newEndDate: newEndDate.toISOString(),
  });
}