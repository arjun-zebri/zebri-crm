/**
 * Spend ceilings shared by every Zebri AI surface.
 *
 * The cap lives here rather than on one route because both the copilot
 * and the review-card rewrite increment the same counter. If it sat on
 * a route module, the second surface would have to import a route to
 * read it, dragging that route's rate limiter into its bundle.
 *
 * @module lib/workflows/ai-copilot/limits
 */

/** Model calls per user per day, across all AI surfaces. */
export const DAILY_MESSAGE_CAP = 100
