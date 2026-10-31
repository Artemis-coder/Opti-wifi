import { createServerClient } from '@/lib/neon/server';
import { getSessionContext } from '@/lib/tenant';

export type QuotaType = 'users' | 'collectors' | 'points_of_sale' | 'tickets_per_month';

export interface QuotaLimits {
  max_users: number | null;
  max_points_of_sale: number | null;
  max_collectors: number | null;
  max_tickets_per_month: number | null;
  plan_name: string | null;
}

export interface QuotaCheckResult {
  allowed: boolean;
  quota: QuotaType;
  current: number;
  limit: number;
  plan_name: string | null;
  message?: string;
}

/**
 * Get the active subscription plan limits for an organization
 */
export async function getOrganizationQuotaLimits(
  supabase: ReturnType<typeof createServerClient>,
  organizationId: string
): Promise<QuotaLimits> {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select(`
      *,
      plan:subscription_plans(max_users, max_points_of_sale, max_collectors, max_tickets_per_month, name)
    `)
    .eq('organization_id', organizationId)
    .in('status', ['active', 'trialing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub?.plan) {
    return {
      max_users: null,
      max_points_of_sale: null,
      max_collectors: null,
      max_tickets_per_month: null,
      plan_name: null,
    };
  }

  return {
    max_users: sub.plan.max_users ?? null,
    max_points_of_sale: sub.plan.max_points_of_sale ?? null,
    max_collectors: sub.plan.max_collectors ?? null,
    max_tickets_per_month: sub.plan.max_tickets_per_month ?? null,
    plan_name: sub.plan.name ?? null,
  };
}

/**
 * Check if organization has reached a specific quota limit
 */
export async function checkQuota(
  supabase: ReturnType<typeof createServerClient>,
  organizationId: string,
  quotaType: QuotaType
): Promise<QuotaCheckResult> {
  const limits = await getOrganizationQuotaLimits(supabase, organizationId);

  let limit: number | null;
  let current: number;
  let quotaLabel: string;

  switch (quotaType) {
    case 'users':
      limit = limits.max_users;
      quotaLabel = 'max_users';
      if (limit === null) {
        return { allowed: true, quota: quotaType, current: 0, limit: -1, plan_name: limits.plan_name };
      }
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_active', true); // les membres supprimés ne comptent plus
      current = userCount ?? 0;
      break;

    case 'collectors':
      limit = limits.max_collectors;
      quotaLabel = 'max_collectors';
      if (limit === null || limit < 0) {
        return { allowed: true, quota: quotaType, current: 0, limit: -1, plan_name: limits.plan_name };
      }
      const { count: collectorCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('role', 'collecteur')
        .eq('is_active', true);
      current = collectorCount ?? 0;
      break;

    case 'points_of_sale':
      limit = limits.max_points_of_sale;
      quotaLabel = 'max_points_of_sale';
      if (limit === null) {
        return { allowed: true, quota: quotaType, current: 0, limit: -1, plan_name: limits.plan_name };
      }
      const { count: posCount } = await supabase
        .from('points_of_sale')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);
      current = posCount ?? 0;
      break;

    case 'tickets_per_month':
      limit = limits.max_tickets_per_month;
      quotaLabel = 'max_tickets_per_month';
      if (limit === null) {
        return { allowed: true, quota: quotaType, current: 0, limit: -1, plan_name: limits.plan_name };
      }
      // Count tickets sold in current month via collection_items joined with collections
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const { count: ticketCount } = await supabase
        .from('collection_items')
        .select('collections(created_at)', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .gte('collections.created_at', startOfMonth.toISOString());
      current = ticketCount ?? 0;
      break;

    default:
      return { allowed: true, quota: quotaType, current: 0, limit: -1, plan_name: limits.plan_name };
  }

  // -1 (ou toute valeur négative) = illimité
  if (limit < 0) {
    return { allowed: true, quota: quotaType, current, limit: -1, plan_name: limits.plan_name };
  }
  if (current >= limit) {
    return {
      allowed: false,
      quota: quotaType,
      current,
      limit,
      plan_name: limits.plan_name,
      message: `Limite de ${getQuotaLabel(quotaType)} atteinte (${current}/${limit}) pour le forfait "${limits.plan_name}". Veuillez mettre à niveau votre abonnement.`,
    };
  }

  return { allowed: true, quota: quotaType, current, limit, plan_name: limits.plan_name };
}

/**
 * Check all quotas at once (useful before creating resources)
 */
export async function checkAllQuotas(
  supabase: ReturnType<typeof createServerClient>,
  organizationId: string
): Promise<{ allowed: boolean; results: QuotaCheckResult[]; message?: string }> {
  const [usersCheck, posCheck, ticketsCheck] = await Promise.all([
    checkQuota(supabase, organizationId, 'users'),
    checkQuota(supabase, organizationId, 'points_of_sale'),
    checkQuota(supabase, organizationId, 'tickets_per_month'),
  ]);

  const results = [usersCheck, posCheck, ticketsCheck];
  const blocked = results.find((r) => !r.allowed);

  return {
    allowed: !blocked,
    results,
    message: blocked?.message,
  };
}

/**
 * Get human-readable quota label
 */
function getQuotaLabel(quota: QuotaType): string {
  switch (quota) {
    case 'users':
      return 'utilisateurs';
    case 'collectors':
      return 'collecteurs';
    case 'points_of_sale':
      return 'points de vente';
    case 'tickets_per_month':
      return 'tickets par mois';
  }
}

/**
 * Get the organization ID for the current authenticated user
 */
export async function getUserOrganizationId(
  _supabase: ReturnType<typeof createServerClient>
): Promise<string | null> {
  // Organisation de l'utilisateur, uniquement si elle n'est pas suspendue / supprimée / en attente
  const ctx = await getSessionContext();
  if (!ctx || ctx.organizationBlocked) return null;
  return ctx.organizationId;
}