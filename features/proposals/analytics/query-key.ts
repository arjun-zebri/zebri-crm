/**
 * The react-query key prefix every proposal analytics query sits under.
 *
 * Lives in the feature, not the app hook, so the editor (inside the
 * feature boundary) and the app's send and accept paths invalidate the
 * one key instead of each repeating the string. Kept out of `./data`,
 * which is a `'use server'` module and may only export async functions.
 *
 * @module features/proposals/analytics/query-key
 */

/** Prefix of the account and per-template analytics queries: invalidate it after a send or an accept. */
export const PROPOSAL_ANALYTICS_QUERY_KEY = ['proposal-analytics'] as const
