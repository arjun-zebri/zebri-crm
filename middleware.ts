import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  "/quote",
  "/invoice",
  "/portal",
  "/contract",
];

function withCookies(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
  return target;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
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

  // If no user and not a public route, redirect to login
  if (!user && !isPublicRoute) {
    return withCookies(
      response,
      NextResponse.redirect(new URL("/login", request.url))
    );
  }

  // If user exists and on a public route (auth pages), allow access
  // (users can view login page even if logged in)
  if (user && isPublicRoute) {
    return response;
  }

  // Gate /admin to admins only
  if (user && pathname.startsWith("/admin")) {
    if (user.user_metadata?.account_type !== "admin") {
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
    const metadata = user.user_metadata || {};

    const subscriptionStatus = metadata.subscription_status;
    const trialEnd = metadata.trial_end;
    const subscriptionEnd = metadata.subscription_end;

    const now = new Date().getTime();
    const trialEndTime = trialEnd ? new Date(trialEnd).getTime() : 0;
    const subscriptionEndTime = subscriptionEnd
      ? new Date(subscriptionEnd).getTime()
      : 0;

    const hasAccess =
      (subscriptionStatus === "trialing" && trialEndTime > now) ||
      subscriptionStatus === "active" ||
      (subscriptionStatus === "cancelled" && subscriptionEndTime > now);

    if (!hasAccess) {
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
