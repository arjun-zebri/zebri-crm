import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isAdmin, subscriptionStatus } from "@/lib/auth/entitlements";
import { sameOriginPathSchema } from "@/lib/auth/schemas";
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
  "/api/email/send-contract-reminders",
  "/timeline",
  "/invoice",
  "/portal",
  "/contract",
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
];

function withCookies(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
  return target;
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

  // Clear stale shadow cookies if the current user is the shadow admin
  // (they re-authenticated as themselves without exiting shadow mode)
  if (user) {
    const shadowAdminId = request.cookies.get("zebri_shadow_admin_id")?.value;
    if (shadowAdminId && shadowAdminId === user.id) {
      response.cookies.delete("zebri_shadow_admin_id");
      response.cookies.delete("zebri_is_shadowing");
      request.cookies.delete("zebri_shadow_admin_id");
      request.cookies.delete("zebri_is_shadowing");
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
  // Skip for: /settings, /admin, /api/stripe/*, /api/alerts/*, and any shadow mode session.
  const isShadowing = request.cookies.get("zebri_shadow_admin_id")?.value;
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
