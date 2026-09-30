/**
 * Moved to `features/proposals/analytics` (R4). Kept as a re-export so
 * callers outside the proposals feature keep compiling; R5 deletes it.
 *
 * @module lib/proposals/engagement-labels
 */
// Why: a deliberate, temporary back-edge so old import paths keep working until R5.
// eslint-disable-next-line no-restricted-imports
export * from '@/features/proposals/analytics/labels'
