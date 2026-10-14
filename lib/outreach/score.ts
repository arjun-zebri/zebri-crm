/**
 * Activity score (0-100) and verdict for a celebrant.
 *
 * The verdict rule is the founder's (2026-10-11): active when Instagram
 * posted within 180 days OR the website is live with a recent year or
 * wedding content. The score only ranks people inside a verdict, so
 * outreach reaches the busiest celebrants first.
 *
 * Pure. Inputs are what the prospect row stores after the checks.
 *
 * @module lib/outreach/score
 */

/** The stored verdict. */
export type Verdict = 'unchecked' | 'active' | 'inactive' | 'needs_review';

/** Signals the scorer reads. Nulls mean "not checked / no data". */
export interface ActivityInputs {
  siteStatus: 'live' | 'parked' | 'dead_dns' | 'http_error' | 'timeout' | 'blocked' | 'no_site' | null;
  siteLatestYear: number | null;
  siteHasWeddingContent: boolean | null;
  hasInstagramHandle: boolean;
  igStatus: 'ok' | 'not_found' | 'private' | 'error' | null;
  igLastPostAt: string | null;
  igFollowers: number | null;
}

/** Score, verdict and the reason shown in the UI. */
export interface ActivityResult {
  score: number;
  verdict: Exclude<Verdict, 'unchecked'>;
  reason: string;
}

const DAY = 86_400_000;

/** Days since the last IG post, or null. */
function igAgeDays(input: ActivityInputs, now: Date): number | null {
  if (!input.igLastPostAt) return null;
  return Math.max(0, (now.getTime() - Date.parse(input.igLastPostAt)) / DAY);
}

/** True when the website alone proves the celebrant is working. */
export function siteSaysActive(input: Pick<ActivityInputs, 'siteStatus' | 'siteLatestYear' | 'siteHasWeddingContent'>, now: Date = new Date()): boolean {
  if (input.siteStatus !== 'live') return false;
  const recentYear = input.siteLatestYear !== null && input.siteLatestYear >= now.getUTCFullYear() - 1;
  return recentYear || input.siteHasWeddingContent === true;
}

/** Compute the 0-100 score. */
export function activityScore(input: ActivityInputs, now: Date = new Date()): number {
  let score = 0;
  const age = igAgeDays(input, now);
  if (age !== null) {
    if (age <= 30) score += 50;
    else if (age <= 90) score += 40;
    else if (age <= 180) score += 30;
  }
  if (input.igFollowers && input.igFollowers > 0) {
    // log10: 10 followers = 2.5, 100 = 5, 1k = 7.5, 10k+ = 10.
    score += Math.min(10, (Math.log10(input.igFollowers) / 4) * 10);
  }
  if (input.siteStatus === 'live') {
    score += 20;
    if (input.siteLatestYear !== null && input.siteLatestYear >= now.getUTCFullYear() - 1) score += 15;
    if (input.siteHasWeddingContent) score += 5;
  }
  return Math.min(100, Math.round(score));
}

/** Score + verdict + reason. */
export function evaluateActivity(input: ActivityInputs, now: Date = new Date()): ActivityResult {
  const score = activityScore(input, now);
  const age = igAgeDays(input, now);

  if (age !== null && age <= 180) return { score, verdict: 'active', reason: 'ig_recent' };
  if (siteSaysActive(input, now)) return { score, verdict: 'active', reason: 'site_current' };

  // A check that could not answer is not evidence of inactivity.
  const siteUnknown = input.siteStatus === 'timeout' || input.siteStatus === 'http_error' || input.siteStatus === 'blocked';
  const igUnknown = input.hasInstagramHandle && (input.igStatus === null || input.igStatus === 'error');
  if (siteUnknown || igUnknown) return { score, verdict: 'needs_review', reason: 'check_incomplete' };

  if (input.siteStatus === 'no_site' && !input.hasInstagramHandle) {
    return { score, verdict: 'inactive', reason: 'no_presence' };
  }
  if (input.siteStatus === 'parked' || input.siteStatus === 'dead_dns') {
    return { score, verdict: 'inactive', reason: 'site_dead' };
  }
  if (input.igStatus === 'private') return { score, verdict: 'inactive', reason: 'ig_private' };
  return { score, verdict: 'inactive', reason: 'stale' };
}

/**
 * Whether an IG lookup is worth paying for during the activity check:
 * there is a handle, and the website did not already settle "active".
 */
export function needsInstagramLookup(input: Pick<ActivityInputs, 'siteStatus' | 'siteLatestYear' | 'siteHasWeddingContent' | 'hasInstagramHandle'>, now: Date = new Date()): boolean {
  return input.hasInstagramHandle && !siteSaysActive(input, now);
}
