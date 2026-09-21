/**
 * Feature flag for the Proposal Layout v2 shell (spec D7, §5.1).
 *
 * A plain module, not `'use client'`: `templates/page.tsx`,
 * `analytics/page.tsx` and `settings/page.tsx` are server components, and
 * calling a function exported from a `'use client'` file on the server
 * fails in Next.js. `NEXT_PUBLIC_*` env vars are inlined at build time by
 * Next.js wherever they are read, so this reads identically whether it's
 * imported on the client (by `proposals-nav.tsx`) or on the server (by the
 * three route pages).
 *
 * @module app/(dashboard)/proposals/flags
 */

/** True when the Proposal Layout v2 shell (Templates / Analytics / Settings) is switched on for this build. */
export function proposalLayoutV2Enabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PROPOSAL_LAYOUT_V2)
}
