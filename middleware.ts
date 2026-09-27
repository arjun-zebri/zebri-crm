import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  jwtSessionId,
  logShadowRequest,
  SHADOW_REQUEST_LOG_TIMEOUT_MS,
  SHADOW_SESSION_COOKIE,
  shadowMarkerMatch,
  type ShadowMarkerMatch,
} from "@/lib/admin/shadow-sessions";
import { sendAlert } from "@/lib/alerts/send-alert";
import { isAdmin, subscriptionStatus } from "@/lib/auth/entitlements";
import { hasVerifiedFactor, needsSecondFactor, SECOND_FACTOR_PATH } from "@/lib/auth/mfa";
import { sameOriginPathSchema } from "@/lib/auth/schemas";
import {
  SHADOW_ADMIN_COOKIE,
  SHADOW_FLAG_COOKIE,
  SHADOW_GRANT_COOKIE,
  type ShadowAdminStatus,
  shadowGrantSecret,
  shadowWaiverApplies,
  verifyShadowGrant,
} from "@/lib/auth/shadow-grant";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/reset-password",
  "/update-password",
  "/api/alerts",
  "/api/stripe/invoice-payment",
  "/api/stripe/webhook",
  "/api/portal",
  "/api/contract",
  "/api/cron",
  "/timeline",
  "/invoice",
  "/portal",
  "/contract",
  // Public proposal page + its accept/decline/events endpoints (Phases C/D).
  // Token-gated. Trailing slash on both "/proposal/" and "/api/proposal/"
  // (not "/proposal" / "/api/proposal") so these don't prefix-match the
  // private dashboard route at "/proposals" (or a future "/api/proposals").
  "/proposal/",
  "/api/proposal/",
  // Couple-facing questionnaire fill page + its save/submit endpoints —
  // token-gated (share_token is the capability), no session expected.
  "/questionnaire",
  "/api/questionnaire",
  // Public lead-capture surfaces — the capture token is the capability,
  // no session expected (prospective couples aren't logged in, and the
  // embed is loaded cross-site so no cookie is sent anyway). Covers the
  // hosted form + embed variant (`/lead/<token>`), the embed loader
  // script (`/lead-embed.js`), and the submit endpoint (`/api/lead/*`).
  "/lead",
  "/api/lead",
  // Public API docs + llms.txt for AI coding tools. Static content, no
  // session; the matcher only skips image extensions, so `.txt` needs this.
  "/docs",
  "/llms.txt",
  // Public booking surfaces: the share token is the capability,
  // no session expected. Covers the booking page + embed variant (`/book/<token>`),
  // the embed loader script (`/book-embed.js`), and the submit endpoint (`/api/booking/*`).
  "/book",
  "/api/booking",
  // Internal component showroom. The route itself 404s in production
  // (see app/design-system/layout.tsx); this entry only keeps the
  // dev-server middleware from bouncing it to /login.
  "/design-system",
  // Public unsubscribe confirmation page + its confirm endpoint (Phase 2,
  // Task 11). The Spam Act Regulations forbid requiring a login to opt
  // out, so this must never sit behind the auth wall: the exact gap that
  // broke the questionnaire fill page before this list existed.
  "/unsubscribe",
  "/api/unsubscribe",
  // Resend's bounce/complaint webhook (Phase 2, Task 14). Resend sends no
  // session cookie; the Svix signature checked inside the handler is the
  // capability. The full path, not "/api/resend", so nothing else under
  // that prefix is opened by accident.
  "/api/resend/webhook",
];

function withCookies(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
  return target;
}

/** Whether the admin a shadow grant names is still an admin today. */
async function adminStatus(adminId: string): Promise<ShadowAdminStatus> {
  try {
    const { data, error } = await createAdminClient().auth.admin.getUserById(adminId);
    if (error || !data.user) return "lookup_failed";
    return isAdmin(data.user) ? "admin" : "not_admin";
  } catch {
    // Missing service-role env or Auth unreachable: fail closed, the
    // admin lands on the code screen instead of skipping it.
    return "lookup_failed";
  }
}

// Process-local dedupe for the revoke-failure alert: one per session per
// hour, and the map is bounded so a flood of failures cannot grow it.
const REVOKE_ALERT_WINDOW_MS = 60 * 60 * 1000;
const revokeAlertedAt = new Map<string, number>();

/** Whether this session's failed revoke should alert now (and note that it did). */
function shouldAlertRevokeFailure(sessionId: string, now: number): boolean {
  const last = revokeAlertedAt.get(sessionId);
  if (last !== undefined && now - last < REVOKE_ALERT_WINDOW_MS) return false;
  if (revokeAlertedAt.size >= 500) revokeAlertedAt.clear();
  revokeAlertedAt.set(sessionId, now);
  return true;
}

/**
 * End a shadow session whose grant has gone (review I1): revoke this
 * browser's target session (scope local, so the MC's other devices stay
 * signed in), drop every shadow cookie including the marker, and send
 * the browser to /login.
 *
 * If Auth cannot revoke it, the browser still leaves the session: its
 * Supabase auth cookies are dropped by name. Otherwise, with the marker
 * already deleted, the browser would carry on as the MC with no banner
 * and nothing left to end it. The session itself stays live on the
 * server, so Slack is told (ids only, once an hour per session) and the
 * server-side sweep in the tick revokes it later.
 */
async function endExpiredShadowSession(
  request: NextRequest,
  ids: { sessionId: string; userId: string },
  // A getter: signing out rewrites the auth cookies through setAll, which
  // replaces the middleware's response object.
  response: () => NextResponse,
  signOutLocal: () => Promise<{ error: unknown }>,
): Promise<NextResponse> {
  let revokeFailed = false;
  try {
    revokeFailed = !!(await signOutLocal()).error;
  } catch {
    revokeFailed = true;
  }
  const out = withCookies(response(), NextResponse.redirect(new URL("/login", request.url)));
  for (const name of [SHADOW_ADMIN_COOKIE, SHADOW_FLAG_COOKIE, SHADOW_GRANT_COOKIE, SHADOW_SESSION_COOKIE]) {
    out.cookies.delete(name);
  }
  if (revokeFailed) {
    console.error("[middleware] expired shadow session not revoked; dropping its cookies");
    if (shouldAlertRevokeFailure(ids.sessionId, Date.now())) {
      void sendAlert({
        type: "app_error",
        severity: "error",
        source: "middleware.shadowExpiry",
        message: `expired shadow session ${ids.sessionId} of user ${ids.userId} not revoked; the tick sweep will retry`,
      }).catch((err: unknown) => console.error("[middleware] alert failed:", err));
    }
    for (const { name } of request.cookies.getAll()) {
      if (name.startsWith("sb-") && name.includes("-auth-token")) out.cookies.delete(name);
    }
  }
  return out;
}

/** Methods that only read. Everything else may write, so it is logged. */
const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Record one `shadow_request` row for a request the shadowing admin's
 * browser made (Task 25 fix round 1). Server actions and API routes that
 * write with the service role never reach the database's shadow trigger
 * with a session, so this is their only trail. Awaited (bounded by
 * {@link SHADOW_REQUEST_LOG_TIMEOUT_MS}), so the row is normally written
 * before the action runs; a failure or a timeout is logged and never
 * blocks the request.
 */
async function recordShadowRequest(
  request: NextRequest,
  adminId: string,
  targetUserId: string,
  accessToken: string | undefined,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const write = logShadowRequest(createAdminClient(), {
      adminId,
      targetUserId,
      method: request.method,
      path: request.nextUrl.pathname,
      nextAction: request.headers.get("next-action"),
      sessionId: jwtSessionId(accessToken),
    });
    const timedOut = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), SHADOW_REQUEST_LOG_TIMEOUT_MS);
    });
    const result = await Promise.race([write, timedOut]);
    if (result === "timeout") {
      console.error("[middleware] shadow_request log timed out; request continues");
      // Report a late failure too, so it is not lost silently.
      void write.then(
        (error) => error && console.error("[middleware] shadow_request not logged:", error),
        (err: unknown) => console.error("[middleware] shadow_request not logged:", err),
      );
    } else if (result) {
      console.error("[middleware] shadow_request not logged:", result);
    }
  } catch (err) {
    console.error("[middleware] shadow_request not logged:", err);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // Shadow expiry (Phase 4 fix wave, review I1). The grant, admin-id and
  // banner cookies die at 8 hours; the target session enterShadow minted
  // does not. When the marker names this very session and no grant for
  // this user verifies any more, the admin's shadow visit is over: end
  // it here rather than let the browser carry on as the MC with no
  // banner and no request trail. Only requests carrying the marker pay
  // for the session read, so normal users pay nothing. A marker that
  // names another session, or that is not signed by this server, changes
  // nothing here, but it does withhold the two-factor waiver and the
  // request log below (review M1, N1).
  let shadowMarker: ShadowMarkerMatch = "absent";
  const shadowMarkerValue = request.cookies.get(SHADOW_SESSION_COOKIE)?.value;
  if (user && shadowMarkerValue) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    shadowMarker = await shadowMarkerMatch({
      marker: shadowMarkerValue,
      sessionId: jwtSessionId(session?.access_token),
      sessionUserId: user.id,
      secret: shadowGrantSecret(),
    });
    if (shadowMarker === "match") {
      const liveGrant = await verifyShadowGrant(
        request.cookies.get(SHADOW_GRANT_COOKIE)?.value,
        shadowGrantSecret()
      );
      if (!liveGrant || liveGrant.targetUserId !== user.id) {
        return endExpiredShadowSession(
          request,
          { sessionId: jwtSessionId(session?.access_token) ?? "unknown", userId: user.id },
          () => response,
          () => supabase.auth.signOut({ scope: "local" })
        );
      }
    }
  }

  // Clear stale shadow cookies if the current user is the shadow admin
  // (they re-authenticated as themselves without exiting shadow mode)
  if (user) {
    const shadowAdminId = request.cookies.get("zebri_shadow_admin_id")?.value;
    if (shadowAdminId && shadowAdminId === user.id) {
      response.cookies.delete("zebri_shadow_admin_id");
      response.cookies.delete("zebri_is_shadowing");
      response.cookies.delete(SHADOW_GRANT_COOKIE);
      request.cookies.delete("zebri_shadow_admin_id");
      request.cookies.delete("zebri_is_shadowing");
      request.cookies.delete(SHADOW_GRANT_COOKIE);
    }
  }

  // Shadow request log. Runs before the public-route early return so
  // posts to public prefixes (such as /api/portal uploads) are covered,
  // and is separate from the paywall's own grant check further down.
  // Only a grant that verifies and names this session's user counts.
  if (user && !READ_ONLY_METHODS.has(request.method)) {
    const shadowGrantCookie = request.cookies.get(SHADOW_GRANT_COOKIE)?.value;
    if (shadowGrantCookie) {
      const grant = await verifyShadowGrant(shadowGrantCookie, shadowGrantSecret());
      if (grant && grant.targetUserId === user.id && shadowMarker !== "mismatch") {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        await recordShadowRequest(request, grant.adminId, user.id, session?.access_token);
      }
    }
  }

  // If no user and not a public route, redirect to login.
  // Preserve the requested path as `?next=` so the login page can
  // bounce the user back after they sign in. The `next` value is
  // validated against {@link sameOriginPathSchema} (same-origin
  // relative paths only) so a crafted link can't turn the
  // redirect-after-login into an open redirect — defence in depth on
  // top of the login server action's own check.
  if (!user && !isPublicRoute) {
    const loginUrl = new URL("/login", request.url);
    const nextCandidate = pathname + (request.nextUrl.search ?? "");
    if (sameOriginPathSchema.safeParse(nextCandidate).success) {
      loginUrl.searchParams.set("next", nextCandidate);
    }
    return withCookies(response, NextResponse.redirect(loginUrl));
  }

  // If user exists and on a public route (auth pages), allow access
  // (users can view login page even if logged in)
  if (user && isPublicRoute) {
    return response;
  }

  // Two-factor gate (Phase 4, Task 23). An MC with a verified TOTP
  // factor who has only typed their password (session aal1) gets no
  // further than the code screen. The factor list comes from the
  // server-validated `user`, never the editable copy in the auth cookie
  // (see lib/auth/mfa). A verified shadow session waives it: the admin
  // does not hold the MC's phone, and entering shadow mode needs the
  // admin's own second factor. The session token is only read for users
  // who have a factor, so everyone else pays nothing for this gate.
  if (user && hasVerifiedFactor(user)) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    // The waiver also needs the marker to name this session (review M1):
    // a stolen grant replayed on another sign-in of the MC waives nothing.
    if (
      needsSecondFactor(user, session?.access_token) &&
      !(shadowMarker === "match" && await shadowWaiverApplies({
        claimedAdminId: request.cookies.get(SHADOW_ADMIN_COOKIE)?.value,
        grant: request.cookies.get(SHADOW_GRANT_COOKIE)?.value,
        sessionUserId: user.id,
        now: Date.now(),
        secret: shadowGrantSecret(),
        adminStatus,
      }))
    ) {
      // An API caller gets a status it can act on, not an HTML page.
      if (pathname.startsWith("/api/")) {
        return withCookies(
          response,
          NextResponse.json({ error: "second_factor_required" }, { status: 401 })
        );
      }
      const mfaUrl = new URL(SECOND_FACTOR_PATH, request.url);
      const nextCandidate = pathname + (request.nextUrl.search ?? "");
      if (nextCandidate !== "/" && sameOriginPathSchema.safeParse(nextCandidate).success) {
        mfaUrl.searchParams.set("next", nextCandidate);
      }
      return withCookies(response, NextResponse.redirect(mfaUrl));
    }
  }

  // Gate /admin to admins only — read via the entitlements helper so
  // app_metadata is authoritative (user can't self-elevate via the
  // user-writable user_metadata; §7.4 / Phase 0.8b).
  if (user && pathname.startsWith("/admin")) {
    if (!isAdmin(user)) {
      return withCookies(
        response,
        NextResponse.redirect(new URL("/", request.url))
      );
    }
  }

  // If user exists and on protected route, check subscription paywall.
  // Skip for: /settings, /admin, /api/stripe/*, /api/alerts/*, and a
  // genuine shadow session. Genuine means the signed grant from
  // enterShadow verifies and names this session's user; the bare
  // `zebri_shadow_admin_id` cookie is user-settable, so it alone once let
  // anyone skip the paywall.
  const shadowGrantValue = request.cookies.get(SHADOW_GRANT_COOKIE)?.value;
  const shadowGrant =
    user && shadowGrantValue
      ? await verifyShadowGrant(shadowGrantValue, shadowGrantSecret())
      : null;
  const isShadowing = !!user && shadowGrant?.targetUserId === user.id;
  if (
    user &&
    !isPublicRoute &&
    !isShadowing &&
    !pathname.startsWith("/settings") &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/api/stripe") &&
    !pathname.startsWith("/api/alerts")
  ) {
    // Starter (free) is a real long-term state. Everyone gets in except
    // users with a failed recurring charge — they need to update their
    // payment method. Feature limits (e.g. 5-couple cap on Starter) are
    // enforced at the data layer, not here. The entitlements helper
    // ignores user-writable user_metadata for migrated users — no self-
    // bypass via auth.updateUser({ data: { subscription_status: 'active' } }).
    if (subscriptionStatus(user) === "past_due") {
      return withCookies(
        response,
        NextResponse.redirect(new URL("/settings?tab=billing", request.url))
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
