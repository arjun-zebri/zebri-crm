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

/** One section of a proposal, with how long viewers spent on it and how many of them scrolled as far as it. */
export interface SectionEngagementRow {
  id: string;
  label: string;
  /** Total reading seconds across every session. */
  seconds: number;
  /** Share of sessions that scrolled far enough to see this section, 0 to 100. Falls as the page goes on; the biggest drop is where readers leave. */
  reachPct: number;
}

/** One package's share of attention against the others, and whether it was the one chosen. */
export interface PackageEngagementRow {
  optionId: string;
  title: string;
  /** Sessions in which the package card was viewed. */
  views: number;
  /** Total seconds spent with the card in view. */
  seconds: number;
  chosen: boolean;
}

/** Per-template outcomes, for the cards on /proposals. */
export interface TemplateStats {
  sent: number;
  accepted: number;
  /** Sum of the accepted proposals' chosen-package subtotals, in whole dollars. */
  revenue: number;
}

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
  { sent: 12, accepted: 8, revenue: 17600 },
  { sent: 5, accepted: 2, revenue: 4400 },
  { sent: 0, accepted: 0, revenue: 0 },
];

/** `accepted / sent` as a whole percentage, or `null` when nothing has been sent (0/0 is not 0%). */
export function acceptanceRate(stats: TemplateStats): number | null {
  return stats.sent === 0 ? null : Math.round((stats.accepted / stats.sent) * 100);
}

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
