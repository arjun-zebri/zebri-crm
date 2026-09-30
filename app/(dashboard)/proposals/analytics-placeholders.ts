/**
 * Shapes and sample data for the proposal analytics we have not wired up
 * yet: reading depth by section, package comparison, and per-template
 * acceptance + revenue. The components render these types; the sample
 * constants stand in for a real source until each metric is computed
 * from `proposal_events` (sections, packages) and a `proposals.template_id`
 * link (templates, which is never written today).
 *
 * The detail-page surfaces that show a sample carry a visible "Sample
 * data" pill, so a placeholder can never be read as a real number; the
 * template cards on /proposals do not (dropped 2026-09-19 on the
 * founder's ask). Delete the `SAMPLE_*` constants (and the pills) as each
 * one is wired.
 *
 * @module app/(dashboard)/proposals/analytics-placeholders
 */

import type { PackageEngagementRow, SectionEngagementRow, TemplateStats } from '@/features/proposals';
import { acceptanceRate } from '@/features/proposals';

// Types and `acceptanceRate` moved to `features/proposals/analytics` (R4);
// re-exported so the remaining placeholder users keep compiling until
// Tasks 4 and 5 remove them.
export { acceptanceRate };
export type { PackageEngagementRow, SectionEngagementRow, TemplateStats };

/** The shape a typical proposal reads in: attention front-loaded, reach tapering, a spike on the packages. */
export const SAMPLE_SECTION_ENGAGEMENT: SectionEngagementRow[] = [
  { id: 'hero', label: 'Cover', seconds: 18, reachPct: 100 },
  { id: 'intro', label: 'A note from me', seconds: 42, reachPct: 96 },
  { id: 'packages', label: 'Your options', seconds: 151, reachPct: 88 },
  { id: 'how', label: 'How it works', seconds: 37, reachPct: 71 },
  { id: 'faq', label: 'Questions couples ask', seconds: 24, reachPct: 52 },
  { id: 'accept', label: 'Accept and sign', seconds: 29, reachPct: 45 },
];

/** Fallback package names when the proposal has no options to borrow titles from. */
export const SAMPLE_PACKAGE_TITLES = ['Reception MC', 'Full day', 'Premium'];

/** Sample attention split for up to three packages, by position; the middle one wins, which is the "most popular" slot. */
export const SAMPLE_PACKAGE_FIGURES: Array<Pick<PackageEngagementRow, 'views' | 'seconds' | 'chosen'>> = [
  { views: 3, seconds: 34, chosen: false },
  { views: 4, seconds: 92, chosen: true },
  { views: 2, seconds: 25, chosen: false },
];

/** Deterministic per-card sample so the three cards do not all say the same thing. */
export const SAMPLE_TEMPLATE_STATS: TemplateStats[] = [
  { sent: 12, accepted: 8, revenue: 17600, medianOpenSeconds: null },
  { sent: 5, accepted: 2, revenue: 4400, medianOpenSeconds: null },
  { sent: 0, accepted: 0, revenue: 0, medianOpenSeconds: null },
];

/**
 * Sample package rows over the proposal's real package titles (so the
 * placeholder reads in the MC's own words), falling back to
 * {@link SAMPLE_PACKAGE_TITLES} for a proposal with no options. Capped at
 * three, the length of the sample figures.
 */
export function samplePackageRows(options: Array<{ id: string; title: string; position: number }>): PackageEngagementRow[] {
  const titles = options.length
    ? [...options].sort((a, b) => a.position - b.position).map((o) => ({ optionId: o.id, title: o.title }))
    : SAMPLE_PACKAGE_TITLES.map((title, i) => ({ optionId: `sample-${i}`, title }));
  return titles.slice(0, SAMPLE_PACKAGE_FIGURES.length).map((t, i) => ({ ...t, ...SAMPLE_PACKAGE_FIGURES[i]! }));
}
