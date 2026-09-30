/**
 * Report shapes for proposal analytics: reading depth by section, package
 * comparison, per-template outcomes, device mix and the account rollup.
 * Pure data types plus {@link acceptanceRate}; the computations live in
 * `./reports`.
 *
 * @module features/proposals/analytics/types
 */

/** One section of a proposal, with how long viewers spent on it and how many of them scrolled as far as it. */
export interface SectionEngagementRow {
  id: string
  label: string
  /** Total reading seconds across every session. */
  seconds: number
  /** Share of sessions that reached this section or any later one, 0 to 100. Falls down the page; the biggest drop is where readers leave. */
  reachPct: number
}

/**
 * How a package came to be the couple's pick: `'accepted'` when they
 * signed for it, `'selected'` when they only clicked its card on an
 * unaccepted proposal (a lean, not a commitment), `null` otherwise.
 */
export type PackageChoice = 'accepted' | 'selected' | null

/** One package's share of attention against the others, and whether it was accepted or only selected. */
export interface PackageEngagementRow {
  optionId: string
  title: string
  /** Distinct sessions in which the package card was viewed. */
  views: number
  /** Total seconds spent with the card in view. */
  seconds: number
  /** See {@link PackageChoice}. At most one row per report is non-null. */
  chosenBy: PackageChoice
}

/** Per-template outcomes, for the cards on /proposals. */
export interface TemplateStats {
  sent: number
  accepted: number
  /** Sum of the accepted proposals' chosen-package subtotals, in whole dollars. */
  revenue: number
  /** Median seconds from send to first open across the template's opened proposals, or null when none opened. */
  medianOpenSeconds: number | null
}

/** Sessions by the device that opened the proposal; `unknown` covers v1-era rows and lost `opened` events. */
export interface DeviceSplit {
  phone: number
  tablet: number
  desktop: number
  unknown: number
}

/** Account-wide proposal rollup for the /proposals header. */
export interface AccountSummary {
  sent: number
  accepted: number
  acceptancePct: number | null
  medianOpenSeconds: number | null
  /** Accepted revenue this calendar month, in whole dollars. */
  revenueThisMonth: number
}

/** `accepted / sent` as a whole percentage, or `null` when nothing has been sent (0/0 is not 0%). */
export function acceptanceRate(stats: Pick<TemplateStats, 'sent' | 'accepted'>): number | null {
  return stats.sent === 0 ? null : Math.round((stats.accepted / stats.sent) * 100)
}
