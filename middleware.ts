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
  "/timeline",
  "/quote",
  "/invoice",
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
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

  // If no user and not a public route, redirect to login
  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If user exists and on a public route (auth pages), allow access
  // (users can view login page even if logged in)
  if (user && isPublicRoute) {
    return response;
  }

  // If user exists and on protected route, check subscription paywall
  // Skip paywall check for /settings, /api/stripe/*, and /api/alerts/*
  if (
    user &&
    !isPublicRoute &&
    !pathname.startsWith("/settings") &&
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
      return NextResponse.redirect(new URL("/settings?tab=billing", request.url));
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
