// ============================================================
// OPTIWIFI - PHASE 2: Platform / Super Admin Types
// ============================================================

export type OrganizationStatus =
  | 'pending_approval'
  | 'trial'
  | 'active'
  | 'expiring'
  | 'expired'
  | 'suspended'
  | 'cancelled'
  | 'archived';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'cancelled'
  | 'expired'
  | 'suspended';

export type BillingPeriod = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export type PaymentStatus = 'pending' | 'successful' | 'failed' | 'refunded' | 'cancelled';

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';

export type PlatformRole = 'super_admin' | 'platform_support';

export type PlanStatus = 'active' | 'inactive';

export interface Organization {
  id: string;
  name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  status: OrganizationStatus;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationWithStats extends Organization {
  plan_name?: string | null;
  subscription_status?: SubscriptionStatus | null;
  subscription_end_date?: string | null;
  user_count?: number;
  pos_count?: number;
  ticket_sales?: number;
  revenue?: number;
  last_activity?: string | null;
}

export interface PlatformUser {
  id: string;
  auth_user_id: string | null;
  role: PlatformRole;
  full_name?: string | null;
  email?: string | null;
  is_active: boolean;
  last_login?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  billing_period: BillingPeriod;
  trial_days?: number | null;
  max_users?: number | null;
  max_points_of_sale?: number | null;
  max_tickets_per_month?: number | null;
  features?: Record<string, unknown> | null;
  status: PlanStatus;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  organization_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  start_date?: string | null;
  end_date?: string | null;
  trial_start?: string | null;
  trial_end?: string | null;
  cancel_at_period_end: boolean;
  auto_renew: boolean;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionWithPlan extends Subscription {
  plan?: SubscriptionPlan;
  organization?: Organization;
}

export interface Payment {
  id: string;
  organization_id: string;
  subscription_id?: string | null;
  plan_id?: string | null;
  amount: number;
  currency: string;
  payment_method?: string | null;
  transaction_reference?: string | null;
  status: PaymentStatus;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentWithDetails extends Payment {
  organization?: Organization;
  plan?: SubscriptionPlan;
}

export interface Invoice {
  id: string;
  organization_id: string;
  subscription_id?: string | null;
  invoice_number: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  issued_at?: string | null;
  due_at?: string | null;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformAuditLog {
  id: string;
  platform_user_id?: string | null;
  organization_id?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: string;
}

export interface PlatformAuditLogWithUser extends PlatformAuditLog {
  platform_user?: PlatformUser;
  organization?: Organization;
}

export interface PlatformSettings {
  key: string;
  value: unknown;
  description?: string | null;
  updated_at: string;
}

export interface DashboardKpis {
  total_clients: number;
  active_clients: number;
  suspended_clients: number;
  new_clients_this_week: number;
  new_clients_this_month: number;
  active_subscriptions: number;
  expiring_subscriptions: number;
  expired_subscriptions: number;
  revenue_today: number;
  revenue_this_week: number;
  revenue_this_month: number;
  revenue_this_year: number;
  currency: string;
}

export interface ChartDataPoint {
  date: string;
  new_accounts: number;
  activated: number;
  deactivated: number;
}

export interface SubscriptionChartDataPoint {
  date: string;
  new_subscriptions: number;
  renewals: number;
  expirations: number;
  cancellations: number;
}

export interface RevenueChartDataPoint {
  date: string;
  revenue: number;
}

export interface PlanDistributionData {
  name: string;
  value: number;
  fill: string;
}
