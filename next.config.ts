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

/**
 * Security headers common to every response. The clickjacking guard
 * (`X-Frame-Options`) is intentionally NOT here — it's applied per-route
 * below so the public lead-capture embed can opt out of it.
 */
const baseSecurityHeaders = [
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

// Clickjacking guard for the app proper. Superseded by CSP
// `frame-ancestors` once a full CSP lands.
const frameDenyHeader = { key: "X-Frame-Options", value: "DENY" };

// The lead-capture embed is designed to render inside an iframe on an
// arbitrary MC marketing site, so it can't carry `X-Frame-Options: DENY`.
// `X-Frame-Options` has no allowlist-any-origin value (its `ALLOW-FROM`
// is dead in modern browsers), so `/lead/*` drops it and opens framing
// via CSP `frame-ancestors *` instead. The page is a public, token-gated
// enquiry form with no session to hijack, so the residual clickjacking
// surface is limited to "trick a visitor into submitting an enquiry".
const embedFrameHeader = {
  key: "Content-Security-Policy",
  value: "frame-ancestors *",
};

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Public lead-capture embed — must be frameable on any MC site.
        source: "/lead/:path*",
        headers: [...baseSecurityHeaders, embedFrameHeader],
      },
      {
        // Every other route — page, API, and asset. The negative
        // lookahead keeps this off `/lead/*` so the two frame policies
        // never both apply to the embed.
        source: "/((?!lead/).*)",
        headers: [...baseSecurityHeaders, frameDenyHeader],
      },
    ];
  },
};

export default nextConfig;
