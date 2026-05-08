"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

function createAdminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.account_type !== "admin") {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function listUsers() {
  await assertAdmin();

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  return (data.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? "",
    display_name: (u.user_metadata?.display_name as string) ?? "",
    business_name: (u.user_metadata?.business_name as string) ?? "",
    account_type: (u.user_metadata?.account_type as string) ?? "vendor",
  }));
}

async function patchUserMetadata(
  userId: string,
  patch: Record<string, unknown>
) {
  const admin = createAdminClient();
  const { data: existing, error: getError } = await admin.auth.admin.getUserById(userId);
  if (getError) throw getError;
  const merged = { ...(existing.user?.user_metadata ?? {}), ...patch };
  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: merged,
  });
  if (error) throw error;
}

export async function extendTrial(userId: string, newTrialEndISO: string) {
  await assertAdmin();
  const admin = createAdminClient();
  const { data: existing } = await admin.auth.admin.getUserById(userId);
  const currentStatus = existing.user?.user_metadata?.subscription_status as string | undefined;

  const patch: Record<string, unknown> = { trial_end: newTrialEndISO };
  if (currentStatus === "expired" || currentStatus === "cancelled" || !currentStatus) {
    patch.subscription_status = "trialing";
    patch.is_subscribed = true;
  }
  await patchUserMetadata(userId, patch);
  revalidatePath("/admin");
}

export async function compUser(userId: string, plan: "pro" | "max") {
  await assertAdmin();
  await patchUserMetadata(userId, {
    subscription_status: "active",
    is_subscribed: true,
    subscription_plan: plan,
    is_beta_user: true,
  });
  revalidatePath("/admin");
}

export async function cancelAtPeriodEnd(userId: string) {
  await assertAdmin();
  const admin = createAdminClient();
  const { data: existing } = await admin.auth.admin.getUserById(userId);
  const subId = existing.user?.user_metadata?.stripe_subscription_id as string | undefined;
  if (!subId) throw new Error("User has no Stripe subscription");

  await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
  revalidatePath("/admin");
}

export async function refundLastInvoice(userId: string, amountCents: number) {
  await assertAdmin();
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Refund amount must be a positive integer (cents)");
  }
  const admin = createAdminClient();
  const { data: existing } = await admin.auth.admin.getUserById(userId);
  const customerId = existing.user?.user_metadata?.stripe_customer_id as string | undefined;
  if (!customerId) throw new Error("User has no Stripe customer");

  const intents = await stripe.paymentIntents.list({ customer: customerId, limit: 5 });
  const succeeded = intents.data.find((p) => p.status === "succeeded");
  if (!succeeded) throw new Error("No successful payment to refund");

  const refund = await stripe.refunds.create({
    payment_intent: succeeded.id,
    amount: amountCents,
    reason: "requested_by_customer",
  });
  return { refundId: refund.id, status: refund.status };
}

export async function updateUserProfile(
  userId: string,
  fields: { display_name?: string; business_name?: string }
) {
  await assertAdmin();
  const patch: Record<string, unknown> = {};
  if (typeof fields.display_name === "string") patch.display_name = fields.display_name;
  if (typeof fields.business_name === "string") patch.business_name = fields.business_name;
  if (Object.keys(patch).length === 0) return;
  await patchUserMetadata(userId, patch);
  revalidatePath("/admin");
}

export async function sendPasswordReset(userId: string) {
  await assertAdmin();
  const admin = createAdminClient();
  const { data: target, error: getError } = await admin.auth.admin.getUserById(userId);
  if (getError) throw getError;
  if (!target.user?.email) throw new Error("User has no email");

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: target.user.email,
  });
  if (error) throw error;
  return { recoveryLink: data.properties?.action_link ?? null };
}

export async function deleteUser(userId: string) {
  const adminUser = await assertAdmin();
  if (adminUser.id === userId) throw new Error("Cannot delete yourself");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
  revalidatePath("/admin");
}

export async function fetchUserAnalytics(userId: string) {
  await assertAdmin();
  const { getUserAnalytics } = await import("@/lib/admin-analytics");
  return getUserAnalytics(userId);
}

export async function enterShadow(targetUserId: string) {
  const adminUser = await assertAdmin();

  if (adminUser.id === targetUserId) {
    throw new Error("Cannot shadow yourself");
  }

  const adminSdk = createAdminClient();

  const {
    data: { user: targetUser },
    error: getUserError,
  } = await adminSdk.auth.admin.getUserById(targetUserId);
  if (getUserError || !targetUser?.email) {
    throw getUserError ?? new Error("User not found");
  }

  const { data: linkData, error: linkError } =
    await adminSdk.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.email,
    });
  if (linkError || !linkData.properties.email_otp) {
    throw linkError ?? new Error("Failed to generate session");
  }

  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === "production";

  cookieStore.set("zebri_shadow_admin_id", adminUser.id, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  cookieStore.set("zebri_is_shadowing", "1", {
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.verifyOtp({
    email: targetUser.email,
    token: linkData.properties.email_otp,
    type: "magiclink",
  });
  if (signInError) throw signInError;

  redirect("/");
}

export async function clearShadowCookies() {
  const cookieStore = await cookies();
  cookieStore.delete("zebri_shadow_admin_id");
  cookieStore.delete("zebri_is_shadowing");
}

export async function exitShadow() {
  const cookieStore = await cookies();
  const adminId = cookieStore.get("zebri_shadow_admin_id")?.value;

  if (!adminId) {
    redirect("/admin");
  }

  const adminSdk = createAdminClient();

  const {
    data: { user: adminUser },
    error: getUserError,
  } = await adminSdk.auth.admin.getUserById(adminId);
  if (getUserError || !adminUser?.email) {
    throw getUserError ?? new Error("Admin user not found");
  }

  const { data: linkData, error: linkError } =
    await adminSdk.auth.admin.generateLink({
      type: "magiclink",
      email: adminUser.email,
    });
  if (linkError || !linkData.properties.email_otp) {
    throw linkError ?? new Error("Failed to restore admin session");
  }

  cookieStore.delete("zebri_shadow_admin_id");
  cookieStore.delete("zebri_is_shadowing");

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.verifyOtp({
    email: adminUser.email,
    token: linkData.properties.email_otp,
    type: "magiclink",
  });
  if (signInError) throw signInError;

  redirect("/admin");
}
