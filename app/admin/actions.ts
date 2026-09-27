"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { assertAdmin } from "@/lib/admin/assert-admin";
import { recordAdminAction } from "@/lib/admin/audit";
import {
  endShadowSession,
  jwtSessionId,
  revokeShadowTargetSession,
  SHADOW_SESSION_COOKIE,
  SHADOW_SESSION_COOKIE_MAX_AGE_S,
  startShadowSession,
} from "@/lib/admin/shadow-sessions";
import { sendAlert } from "@/lib/alerts";
import type { AlertEvent } from "@/lib/alerts/events";
import {
  inMemoryLimiter,
  ipOfHeaders,
  SHADOW_RATE_LIMITS,
} from "@/lib/api/rate-limit";
import {
  accountType,
  isAdmin,
  stripeCustomerId,
  stripeSubscriptionId,
  subscriptionStatus,
  updateEntitlements,
} from "@/lib/auth/entitlements";
import { currentAssuranceLevel, hasVerifiedFactor } from "@/lib/auth/mfa";
import {
  SHADOW_ADMIN_COOKIE,
  SHADOW_FLAG_COOKIE,
  SHADOW_GRANT_COOKIE,
  SHADOW_GRANT_TTL_MS,
  shadowGrantSecret,
  signShadowGrant,
  signShadowMarker,
  verifyShadowGrant,
} from '@/lib/auth/shadow-grant';
import { withoutPaymentDetails } from "@/lib/branding/payment-details";
import { stripe } from '@/lib/payments/stripe';
import { createClient } from "@/lib/supabase/server";



function createAdminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
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
    // accountType() honours app_metadata first — no escalation via user_metadata.
    account_type: accountType(u),
  }));
}

/**
 * Patch a user's **display** fields (display_name / business_name etc.) —
 * lives in user_metadata. Entitlement fields go through
 * {@link updateEntitlements} into app_metadata; never use this for
 * subscription / Stripe / account_type fields.
 */
async function patchUserDisplay(
  userId: string,
  patch: Record<string, unknown>
) {
  const admin = createAdminClient();
  const { data: existing, error: getError } = await admin.auth.admin.getUserById(userId);
  if (getError) throw getError;
  // The payment details are left out (Task 23c): the database refuses any
  // change to them outside set_my_payment_details(), so a bank save
  // landing between the read above and this write would otherwise fail
  // the profile edit. GoTrue merges user_metadata key by key, so leaving
  // them out keeps the stored values.
  const merged = { ...withoutPaymentDetails(existing.user?.user_metadata), ...patch };
  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: merged,
  });
  if (error) throw error;
}

// Trials were removed from the signup flow in Phase 1. Comping a user
// is the supported way to grant paid-plan access — no fake trial window
// is needed. The `extendTrial` server action was removed in Phase 13.1.
export async function compUser(userId: string, plan: "pro" | "max") {
  const adminUser = await assertAdmin();
  const admin = createAdminClient();
  const { data: existing } = await admin.auth.admin.getUserById(userId);
  const subId = stripeSubscriptionId(existing.user);
  const targetEmail = existing.user?.email ?? "";

  // Cancel any live Stripe subscription so the user isn't double-billed
  // while we mark them as comped.
  if (subId) {
    try {
      await stripe.subscriptions.cancel(subId);
    } catch (e) {
      console.error("[compUser] failed to cancel Stripe subscription", e);
    }
  }

  // Use a dedicated is_comped flag - never set is_beta_user, which would
  // route the user to STRIPE_BETA_PRICE_ID (lifetime discount) on any
  // future self-subscribe.
  await updateEntitlements(admin.auth.admin, userId, {
    subscription_status: "active",
    is_subscribed: true,
    subscription_plan: plan,
    is_comped: true,
    stripe_subscription_id: undefined,
    cancel_at_period_end: false,
    subscription_end: undefined,
  });
  await recordAdminAction({
    actorId: adminUser.id,
    targetUserId: userId,
    action: 'comp_user',
    details: { plan, cancelledStripeSubId: subId ?? null },
  });
  await sendAlert({
    type: 'admin_user_comped',
    severity: 'warn',
    actorId: adminUser.id,
    targetUserId: userId,
    targetEmail,
    plan,
  });
  revalidatePath("/admin");
}

// Reconcile a user who is paying through Stripe but whose metadata never
// got linked (e.g. webhook never fired, manual subscription created in
// Stripe Dashboard, legacy account from before the lookup table existed).
// Pulls the live state from Stripe and writes everything back to the user.
export async function linkStripeCustomer(userId: string, stripeCustomerId: string) {
  const adminUser = await assertAdmin();
  const trimmed = stripeCustomerId.trim();
  if (!/^cus_[A-Za-z0-9]+$/.test(trimmed)) {
    throw new Error("Stripe customer ID should start with 'cus_'");
  }
  const admin = createAdminClient();

  // Verify the customer exists.
  const customer = await stripe.customers.retrieve(trimmed);
  if (customer.deleted) throw new Error("Stripe customer is deleted");

  // Find the most recent non-cancelled subscription. Stripe lists newest first.
  const subs = await stripe.subscriptions.list({ customer: trimmed, status: "all", limit: 5 });
  const sub = subs.data.find((s) =>
    ["active", "trialing", "past_due", "unpaid"].includes(s.status)
  ) ?? subs.data[0];

  // Match the price ID to one of our plans.
  const priceId = sub?.items.data[0]?.price.id;
  let plan: "pro" | "max" | null = null;
  if (priceId === process.env.STRIPE_MAX_PRICE_ID) plan = "max";
  else if (priceId === process.env.STRIPE_PRO_PRICE_ID) plan = "pro";
  else if (priceId === process.env.STRIPE_BETA_PRICE_ID) plan = "pro";

  // Maintain the lookup table so future webhooks for this customer resolve.
  await admin
    .from("stripe_customers")
    .upsert(
      { stripe_customer_id: trimmed, user_id: userId },
      { onConflict: "stripe_customer_id" }
    );

  const subWithEnd = sub as (typeof sub) & { current_period_end?: number };
  await updateEntitlements(admin.auth.admin, userId, {
    stripe_customer_id: trimmed,
    stripe_subscription_id: sub?.id ?? undefined,
    subscription_status: sub?.status ?? "active",
    subscription_plan: plan ?? undefined,
    is_subscribed: sub ? ["active", "trialing"].includes(sub.status) : true,
    trial_end: sub?.trial_end ? new Date(sub.trial_end * 1000).toISOString() : undefined,
    cancel_at_period_end: !!sub?.cancel_at_period_end,
    subscription_end:
      sub?.cancel_at_period_end && subWithEnd.current_period_end
        ? new Date(subWithEnd.current_period_end * 1000).toISOString()
        : undefined,
  });

  await recordAdminAction({
    actorId: adminUser.id,
    targetUserId: userId,
    action: 'link_stripe_customer',
    details: { stripeCustomerId: trimmed, subscriptionId: sub?.id ?? null, plan },
  });
  revalidatePath("/admin");
  return {
    subscriptionId: sub?.id ?? null,
    status: sub?.status ?? null,
    plan,
  };
}

export async function cancelAtPeriodEnd(userId: string) {
  const adminUser = await assertAdmin();
  const admin = createAdminClient();
  const { data: existing } = await admin.auth.admin.getUserById(userId);
  const subId = stripeSubscriptionId(existing.user);
  if (!subId) throw new Error("User has no Stripe subscription");

  await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
  await recordAdminAction({
    actorId: adminUser.id,
    targetUserId: userId,
    action: 'cancel_at_period_end',
    details: { stripeSubscriptionId: subId },
  });
  revalidatePath("/admin");
}

export async function refundLastInvoice(userId: string, amountCents: number) {
  const adminUser = await assertAdmin();
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Refund amount must be a positive integer (cents)");
  }
  const admin = createAdminClient();
  const { data: existing } = await admin.auth.admin.getUserById(userId);
  const customerId = stripeCustomerId(existing.user);
  const targetEmail = existing.user?.email ?? "";
  if (!customerId) throw new Error("User has no Stripe customer");

  const intents = await stripe.paymentIntents.list({ customer: customerId, limit: 5 });
  const succeeded = intents.data.find((p) => p.status === "succeeded");
  if (!succeeded) throw new Error("No successful payment to refund");

  const refund = await stripe.refunds.create({
    payment_intent: succeeded.id,
    amount: amountCents,
    reason: "requested_by_customer",
  });
  await recordAdminAction({
    actorId: adminUser.id,
    targetUserId: userId,
    action: 'refund_last_invoice',
    details: { amountCents, paymentIntentId: succeeded.id, refundId: refund.id },
  });
  await sendAlert({
    type: 'admin_refund_issued',
    severity: 'warn',
    actorId: adminUser.id,
    targetUserId: userId,
    targetEmail,
    amountCents,
    paymentIntentId: succeeded.id,
  });
  return { refundId: refund.id, status: refund.status };
}

export async function updateUserProfile(
  userId: string,
  fields: { display_name?: string; business_name?: string }
) {
  const adminUser = await assertAdmin();
  const patch: Record<string, unknown> = {};
  if (typeof fields.display_name === "string") patch.display_name = fields.display_name;
  if (typeof fields.business_name === "string") patch.business_name = fields.business_name;
  if (Object.keys(patch).length === 0) return;
  await patchUserDisplay(userId, patch);
  await recordAdminAction({
    actorId: adminUser.id,
    targetUserId: userId,
    action: 'update_user_profile',
    details: patch,
  });
  revalidatePath("/admin");
}

export async function sendPasswordReset(userId: string) {
  const adminUser = await assertAdmin();
  const admin = createAdminClient();
  const { data: target, error: getError } = await admin.auth.admin.getUserById(userId);
  if (getError) throw getError;
  if (!target.user?.email) throw new Error("User has no email");

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: target.user.email,
  });
  if (error) throw error;
  await recordAdminAction({
    actorId: adminUser.id,
    targetUserId: userId,
    action: 'send_password_reset',
    details: { email: target.user.email },
  });
  return { recoveryLink: data.properties?.action_link ?? null };
}

export async function deleteUser(userId: string) {
  const adminUser = await assertAdmin();
  if (adminUser.id === userId) throw new Error("Cannot delete yourself");

  const admin = createAdminClient();
  const { data: existing } = await admin.auth.admin.getUserById(userId);
  const customerId = stripeCustomerId(existing.user);
  const subId = stripeSubscriptionId(existing.user);
  const targetEmail = existing.user?.email ?? "";

  // Stop billing in Stripe before tearing down the auth user. Cascade on
  // stripe_customers FK will remove our lookup row, so any later webhooks
  // for this customer would otherwise be unresolvable.
  if (subId) {
    try {
      await stripe.subscriptions.cancel(subId);
    } catch (e) {
      console.error("[deleteUser] stripe sub cancel failed", e);
    }
  }
  if (customerId) {
    try {
      await stripe.customers.del(customerId);
    } catch (e) {
      console.error("[deleteUser] stripe customer del failed", e);
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
  // Audit + alert AFTER the delete succeeds. The target_user_id FK uses
  // ON DELETE SET NULL so the log row survives the user deletion (the
  // actor link survives, but the target id becomes null on cascade) —
  // we still capture the email in `details` for post-hoc readability.
  await recordAdminAction({
    actorId: adminUser.id,
    targetUserId: null,
    action: 'delete_user',
    details: { deletedUserId: userId, deletedEmail: targetEmail },
  });
  await sendAlert({
    type: 'admin_user_deleted',
    severity: 'error',
    actorId: adminUser.id,
    targetUserId: userId,
    targetEmail,
  });
  revalidatePath("/admin");
}

export async function fetchUserAnalytics(userId: string) {
  await assertAdmin();
  const { getUserAnalytics } = await import('@/lib/admin/admin-analytics');
  return getUserAnalytics(userId);
}

/**
 * Sign the calling admin in as `targetUserId` (shadow mode).
 *
 * Shadow mode waives the target's second factor, so the admin's own
 * sign-in is the only thing standing in front of every MC's account. It
 * therefore requires the admin to have two-factor sign-in on AND this
 * session to have passed it (aal2): one phished admin password must not
 * open every 2FA-protected account (Task 23 review, I3).
 *
 * Returns `{ error }` for a refusal the admin can act on; on success it
 * redirects and never returns.
 */
export async function enterShadow(targetUserId: string): Promise<{ error: string } | void> {
  const adminUser = await assertAdmin();

  if (adminUser.id === targetUserId) {
    throw new Error("Cannot shadow yourself");
  }

  if (!hasVerifiedFactor(adminUser)) {
    return { error: "Turn on two-factor sign-in (Settings, Account) before entering shadow mode." };
  }
  {
    const {
      data: { session },
    } = await (await createClient()).auth.getSession();
    if (currentAssuranceLevel(session?.access_token) !== "aal2") {
      return { error: "Sign in again with your authenticator code before entering shadow mode." };
    }
  }

  // Fail closed before minting anything: without a key there is no grant,
  // and a shadow session with no grant could never exit back to the admin.
  const grantSecret = shadowGrantSecret();
  if (!grantSecret) {
    throw new Error("Shadow mode is not configured");
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

  // Admin id, banner flag and grant all expire together, so the banner
  // and its Exit button disappear when the grant that Exit needs does.
  cookieStore.set("zebri_shadow_admin_id", adminUser.id, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: SHADOW_GRANT_TTL_MS / 1000,
    path: "/",
  });

  cookieStore.set("zebri_is_shadowing", "1", {
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    maxAge: SHADOW_GRANT_TTL_MS / 1000,
    path: "/",
  });

  // The signed grant is what exitShadow and the middleware paywall skip
  // trust. `zebri_shadow_admin_id` is a bare id anyone can set, so it is
  // never enough on its own.
  const grant = await signShadowGrant(
    {
      adminId: adminUser.id,
      targetUserId,
      expiresAt: Date.now() + SHADOW_GRANT_TTL_MS,
    },
    grantSecret
  );
  cookieStore.set(SHADOW_GRANT_COOKIE, grant, {
    httpOnly: true,
    // Same rule as its neighbours: secure in production, and plain over
    // http://localhost in dev, where WebKit drops secure cookies.
    secure: isProd,
    sameSite: "lax",
    maxAge: SHADOW_GRANT_TTL_MS / 1000,
    path: "/",
  });

  const supabase = await createClient();
  const { data: otpData, error: signInError } = await supabase.auth.verifyOtp({
    email: targetUser.email,
    token: linkData.properties.email_otp,
    type: "magiclink",
  });
  if (signInError) throw signInError;

  // Register the session just minted so the database can attribute every
  // write made through it to this admin (Task 25). The id comes from the
  // token the Auth server returned a moment ago, never from the request.
  // Fail closed: an unrecorded shadow session would let the admin change
  // the account with no trail, so revoke it and stop.
  const shadowSessionId = jwtSessionId(otpData.session?.access_token);
  const recordError = shadowSessionId
    ? await startShadowSession(adminSdk, {
        sessionId: shadowSessionId,
        adminId: adminUser.id,
        targetUserId,
      })
    : "no session_id claim on the minted session";
  if (recordError || !shadowSessionId) {
    await supabase.auth.signOut({ scope: "local" });
    await clearShadowCookies();
    await sendAlert({
      type: 'app_error',
      severity: 'error',
      source: 'admin.enterShadow',
      message: `shadow session not recorded, entry refused: ${recordError}`,
    });
    throw new Error("Could not start shadow mode. Sign in again and retry.");
  }

  // Name the shadow session in its own cookie, so middleware can tell
  // this browser is still inside it after the 8 hour grant has gone and
  // sign it out then (review I1). It outlives the grant on purpose: the
  // target session can live until Auth's 168 hour timebox.
  // Signed (review N1): the id alone is readable by anyone holding a
  // session, so only a server-made MAC proves this is the minted one.
  const marker = await signShadowMarker(
    { sessionId: shadowSessionId, targetUserId },
    grantSecret
  );
  cookieStore.set(SHADOW_SESSION_COOKIE, marker, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: SHADOW_SESSION_COOKIE_MAX_AGE_S,
    path: "/",
  });

  // Record + alert BEFORE the redirect — Next's redirect() throws an
  // internal exception, so anything after it never runs.
  await recordAdminAction({
    actorId: adminUser.id,
    targetUserId,
    action: 'enter_shadow',
    details: { targetEmail: targetUser.email, shadowSessionId },
  });
  await sendAlert({
    type: 'admin_shadow_entered',
    severity: 'warn',
    actorId: adminUser.id,
    targetUserId,
    targetEmail: targetUser.email,
  });

  redirect("/");
}

export async function clearShadowCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(SHADOW_ADMIN_COOKIE);
  cookieStore.delete(SHADOW_FLAG_COOKIE);
  cookieStore.delete(SHADOW_GRANT_COOKIE);
}

// Process-local, like every limiter here (see lib/api/rate-limit).
const exitRefusalIpLimiter = inMemoryLimiter(SHADOW_RATE_LIMITS.exitRefusalIp);
const exitRefusalAlertLimiter = inMemoryLimiter(
  SHADOW_RATE_LIMITS.exitRefusalAlerts
);

/** Why {@link exitShadow} refused, reported in the Slack alert. */
type ExitShadowRefusal = Extract<
  AlertEvent,
  { type: "admin_shadow_exit_refused" }
>["reason"];

/**
 * Leave shadow mode: sign the browser back in as the admin who entered it.
 *
 * This action mints a session for another account, and a server action
 * can be posted from any page, so it proves everything before minting:
 * the signed grant from `enterShadow` verifies and is unexpired, the
 * current session is the grant's target, the grant's admin matches the
 * `zebri_shadow_admin_id` cookie, and that user is still an admin today.
 * Anything else redirects to `/login` without minting and alerts Slack.
 */
export async function exitShadow() {
  const cookieStore = await cookies();
  const supabase = await createClient();

  const refuse = async (
    reason: ExitShadowRefusal,
    sessionUserId: string | null,
    claimedAdminId: string | null
  ): Promise<never> => {
    // Drop the shadow cookies so a forged set cannot be replayed.
    cookieStore.delete(SHADOW_ADMIN_COOKIE);
    cookieStore.delete(SHADOW_FLAG_COOKIE);
    cookieStore.delete(SHADOW_GRANT_COOKIE);
    // End this browser's session too. Otherwise an admin whose grant is
    // missing or expired stays signed in as the customer with the banner
    // gone, and /login bounces a signed-in user straight back to `/`.
    // MUST stay `local`: the default `global` revokes every session the
    // customer has on every device. For an attacker this only signs out
    // their own browser.
    if (sessionUserId) {
      await supabase.auth.signOut({ scope: "local" });
    }
    // Two caps so an anonymous script cannot flood Slack: per IP, then a
    // single global budget for floods spread over many addresses. Over
    // either cap the refusal still happens, it just stays quiet.
    const ip = ipOfHeaders(await headers());
    const perIp = await exitRefusalIpLimiter.check(ip);
    const channel = perIp.allowed
      ? await exitRefusalAlertLimiter.check("global")
      : null;
    if (channel?.allowed) {
      // Ids and a reason only: no emails or names in the channel.
      await sendAlert({
        type: "admin_shadow_exit_refused",
        severity: "warn",
        reason,
        sessionUserId,
        claimedAdminId,
      });
    }
    redirect("/login");
  };

  const claimedAdminId = cookieStore.get(SHADOW_ADMIN_COOKIE)?.value ?? null;
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();
  if (!sessionUser) {
    return refuse("no_session", null, claimedAdminId);
  }

  const grant = await verifyShadowGrant(
    cookieStore.get(SHADOW_GRANT_COOKIE)?.value,
    shadowGrantSecret()
  );
  if (!grant) {
    return refuse("invalid_grant", sessionUser.id, claimedAdminId);
  }
  if (grant.targetUserId !== sessionUser.id) {
    return refuse("target_mismatch", sessionUser.id, claimedAdminId);
  }
  if (grant.adminId !== claimedAdminId) {
    return refuse("admin_cookie_mismatch", sessionUser.id, claimedAdminId);
  }

  const adminSdk = createAdminClient();

  const {
    data: { user: adminUser },
    error: getUserError,
  } = await adminSdk.auth.admin.getUserById(grant.adminId);
  if (getUserError || !adminUser?.email) {
    return refuse("admin_lookup_failed", sessionUser.id, grant.adminId);
  }
  // A demoted admin must not be able to come back through an old grant.
  if (!isAdmin(adminUser)) {
    return refuse("not_admin", sessionUser.id, grant.adminId);
  }

  // Read the shadow session's id while the browser still holds it: the
  // sign-in below replaces it. getUser() above validated this token.
  const {
    data: { session: shadowSession },
  } = await supabase.auth.getSession();
  const shadowSessionId = jwtSessionId(shadowSession?.access_token);

  const { data: linkData, error: linkError } =
    await adminSdk.auth.admin.generateLink({
      type: "magiclink",
      email: adminUser.email,
    });
  if (linkError || !linkData.properties.email_otp) {
    throw linkError ?? new Error("Failed to restore admin session");
  }

  // Revoke the target session this browser holds before leaving it, so a
  // copied token stops refreshing the moment support leaves and nothing
  // the MC does afterwards is attributed to the admin (review I1, I2).
  // Scope local: the MC's own sessions on other devices stay signed in.
  // A failure alerts (ids only) but never traps the admin in shadow mode.
  const revokeError = await revokeShadowTargetSession(
    adminSdk,
    shadowSession?.access_token
  );
  if (revokeError) {
    await sendAlert({
      type: "app_error",
      severity: "error",
      source: "admin.exitShadow",
      message: `shadow target session ${shadowSessionId ?? "unknown"} of user ${grant.targetUserId} not revoked: ${revokeError}`,
    });
  }

  cookieStore.delete(SHADOW_ADMIN_COOKIE);
  cookieStore.delete(SHADOW_FLAG_COOKIE);
  cookieStore.delete(SHADOW_GRANT_COOKIE);
  cookieStore.delete(SHADOW_SESSION_COOKIE);

  const { error: signInError } = await supabase.auth.verifyOtp({
    email: adminUser.email,
    token: linkData.properties.email_otp,
    type: "magiclink",
  });
  if (signInError) throw signInError;

  // Close the session record so writes stop being attributed. Best
  // effort: the admin is already out, and the row expires with the
  // grant anyway, so a failure alerts rather than blocks the exit.
  const endError = await endShadowSession(adminSdk, {
    sessionId: shadowSessionId,
    adminId: adminUser.id,
    targetUserId: grant.targetUserId,
  });
  if (endError) {
    await sendAlert({
      type: "app_error",
      severity: "error",
      source: "admin.exitShadow",
      message: `shadow session not closed: ${endError}`,
    });
  }

  // Record before redirect; exit is non-destructive so no Slack alert.
  await recordAdminAction({
    actorId: adminUser.id,
    targetUserId: null,
    action: 'exit_shadow',
    details: { shadowSessionId },
  });

  redirect("/admin");
}
