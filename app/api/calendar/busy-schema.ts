/**
 * Zod schema for the owner-scoped busy intervals API query parameters.
 *
 * Plain module: exports only types and the schema for use by route.ts.
 * The route file must not re-export this schema (see the memory note
 * about directive file exports causing runtime crashes).
 *
 * @module app/api/calendar/busy-schema
 */

import { z } from 'zod';

/**
 * Longest span a single busy query may cover.
 *
 * Sized for a padded month grid. Both providers happily serve two months in
 * one call, so the ceiling exists to stop an unbounded request rather than to
 * respect any API limit.
 */
const MAX_RANGE_DAYS = 62;

/**
 * Query schema for GET /api/calendar/busy.
 *
 * Accepts ISO date range (from/to) for the MC's own calendar visibility.
 * Enforces a maximum range and validates that `to` is not before `from`.
 *
 * The cap is 62 days rather than 31 because a month grid is six weeks of
 * cells, padded a week either side so the leading and trailing days from the
 * neighbouring months are covered. That is roughly 44 days, and a 31-day cap
 * silently rejected every month-view request, which is why the month grid
 * showed no external busy time at all.
 */
export const busyQuerySchema = z
  .object({
    from: z.string().date('from must be YYYY-MM-DD'),
    to: z.string().date('to must be YYYY-MM-DD'),
  })
  .refine((data) => data.to >= data.from, {
    message: 'to must not be before from',
    path: ['to'],
  })
  .refine((data) => {
    const fromDate = new Date(data.from);
    const toDate = new Date(data.to);
    const diffMs = toDate.getTime() - fromDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays <= MAX_RANGE_DAYS;
  }, {
    message: `range must not exceed ${MAX_RANGE_DAYS} days`,
    path: ['to'],
  });

export type BusyQuery = z.infer<typeof busyQuerySchema>;
