import type { NextConfig } from "next";

/**
 * Security headers applied to every response.
 *
 * Conservative starter set (Phase 0.8a) — no `Content-Security-Policy`
 * yet because CSP needs per-page testing against the Stripe / Supabase /
 * inline-theme-bootstrap script set. A `report-only` CSP pass lands in a
 * later tightening phase; see `.claude/docs/security.md`.
 *
 * - HSTS is sent only in production so dev (http://localhost) isn't
 *   force-upgraded in the browser forever.
 */
const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  // Clickjacking guard. Superseded by CSP `frame-ancestors` once CSP lands.
  { key: "X-Frame-Options", value: "DENY" },
  // Disable MIME sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs to third-party resources.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Allow microphone on first-party (same-origin) frames only, used
  // by the AudioRecorder in the couple-portal Contacts tab to record
  // name pronunciations. Other powerful APIs stay denied across the
  // board. `microphone=()` previously blocked even first-party use,
  // so the permission prompt never appeared.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), interest-cohort=()",
  },
  // HSTS — prod only, two-year max-age, includeSubDomains.
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply to every route — page, API, and asset.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
