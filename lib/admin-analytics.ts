import { createClient as createServiceClient } from "@supabase/supabase-js";

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const PLAN_PRICE: Record<string, number> = { pro: 49, max: 89 };

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  business_name: string;
  account_type: "vendor" | "admin";
  subscription_status: SubscriptionStatus | null;
  subscription_plan: "pro" | "max" | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_end: string | null;
  subscription_end: string | null;
  is_subscribed: boolean;
  is_beta_user: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

export async function listUsersWithSubscription(): Promise<AdminUser[]> {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  return (data.users ?? []).map((u) => {
    const m = u.user_metadata ?? {};
    return {
      id: u.id,
      email: u.email ?? "",
      display_name: (m.display_name as string) ?? "",
      business_name: (m.business_name as string) ?? "",
      account_type: ((m.account_type as string) ?? "vendor") as "vendor" | "admin",
      subscription_status: (m.subscription_status as SubscriptionStatus) ?? null,
      subscription_plan: (m.subscription_plan as "pro" | "max" | null) ?? null,
      stripe_customer_id: (m.stripe_customer_id as string) ?? null,
      stripe_subscription_id: (m.stripe_subscription_id as string) ?? null,
      trial_end: (m.trial_end as string) ?? null,
      subscription_end: (m.subscription_end as string) ?? null,
      is_subscribed: Boolean(m.is_subscribed),
      is_beta_user: Boolean(m.is_beta_user),
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    };
  });
}

export interface UserAnalytics {
  couples: number;
  events: number;
  invoices: number;
  contracts: number;
  lastSignInAt: string | null;
}

export async function getUserAnalytics(userId: string): Promise<UserAnalytics> {
  const admin = adminClient();

  const [couples, events, invoices, contracts, userRes] = await Promise.all([
    admin.from("couples").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("events").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("invoices").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("contracts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.auth.admin.getUserById(userId),
  ]);

  return {
    couples: couples.count ?? 0,
    events: events.count ?? 0,
    invoices: invoices.count ?? 0,
    contracts: contracts.count ?? 0,
    lastSignInAt: userRes.data.user?.last_sign_in_at ?? null,
  };
}

export interface GlobalStats {
  health: {
    total: number;
    active: number;
    trialing: number;
    past_due: number;
    cancelled: number;
    expired: number;
    mrr: number;
  };
  planDistribution: { starter: number; pro: number; max: number };
  funnel: {
    signupsThisWeek: number;
    signupsThisMonth: number;
    allTime: number;
    trialToPaidRate: number;
  };
  activity: {
    couples: number;
    events: number;
    invoices: number;
    contracts: number;
  };
}

export async function getGlobalStats(): Promise<GlobalStats> {
  const admin = adminClient();
  const users = await listUsersWithSubscription();

  const health = {
    total: users.length,
    active: 0,
    trialing: 0,
    past_due: 0,
    cancelled: 0,
    expired: 0,
    mrr: 0,
  };
  const planDistribution = { starter: 0, pro: 0, max: 0 };

  let usersWhoEverTrialed = 0;
  let usersWhoConverted = 0;

  const now = Date.now();
  const week = now - 7 * 24 * 60 * 60 * 1000;
  const month = now - 30 * 24 * 60 * 60 * 1000;
  let signupsThisWeek = 0;
  let signupsThisMonth = 0;

  for (const u of users) {
    if (u.subscription_status && u.subscription_status in health) {
      (health as Record<string, number>)[u.subscription_status]++;
    }

    if (u.subscription_status === "active") {
      if (u.subscription_plan === "pro") planDistribution.pro++;
      else if (u.subscription_plan === "max") planDistribution.max++;
      else planDistribution.starter++;

      if (u.subscription_plan && PLAN_PRICE[u.subscription_plan]) {
        health.mrr += PLAN_PRICE[u.subscription_plan];
      }
    } else {
      planDistribution.starter++;
    }

    if (u.trial_end) usersWhoEverTrialed++;
    if (u.trial_end && u.stripe_customer_id && u.subscription_status === "active") {
      usersWhoConverted++;
    }

    const created = new Date(u.created_at).getTime();
    if (created > week) signupsThisWeek++;
    if (created > month) signupsThisMonth++;
  }

  const [couples, events, invoices, contracts] = await Promise.all([
    admin.from("couples").select("id", { count: "exact", head: true }),
    admin.from("events").select("id", { count: "exact", head: true }),
    admin.from("invoices").select("id", { count: "exact", head: true }),
    admin.from("contracts").select("id", { count: "exact", head: true }),
  ]);

  return {
    health,
    planDistribution,
    funnel: {
      signupsThisWeek,
      signupsThisMonth,
      allTime: users.length,
      trialToPaidRate: usersWhoEverTrialed > 0 ? usersWhoConverted / usersWhoEverTrialed : 0,
    },
    activity: {
      couples: couples.count ?? 0,
      events: events.count ?? 0,
      invoices: invoices.count ?? 0,
      contracts: contracts.count ?? 0,
    },
  };
}
