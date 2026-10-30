/**
 * The wedding-date filter family shared by every trigger whose payload
 * carries an `event_date` (couple, invoice, contract and proposal
 * events) or a `date` (event rows).
 *
 * Lives in its own module so a trigger file under `triggers/` can
 * import it without importing the registry back (a cycle): the
 * registry in `../triggers` imports those files.
 *
 * @module lib/automations/triggers/event-date
 */

import { z } from 'zod'

import {
  COMPARISON_OPS,
  DAY_OF_WEEK_BUCKETS,
  MONTHS,
  SEASONS,
  compareNumber,
  dateMatchesDayOfWeek,
  monthOfDate,
  seasonOfDate,
  type ComparisonOp,
  type DayOfWeekBucket,
} from '../trigger-constants'

/**
 * Compare "days from now until `date`" against a threshold. A past
 * date gives a negative count, so "at most 7 days" matches something
 * already overdue, which is what an MC expects from that phrasing.
 *
 * Returns false for an absent or unparseable date: a filter on how
 * far away something is cannot be satisfied by something with no date.
 */
export function daysFromNowMatches(
  date: string | null,
  op: ComparisonOp,
  value: number,
): boolean {
  if (!date) return false
  const ts = new Date(date).getTime()
  if (Number.isNaN(ts)) return false
  const days = Math.floor((ts - Date.now()) / (1000 * 60 * 60 * 24))
  return compareNumber(days, op, value)
}

/**
 * Days-until-event filter, anchored on an ISO date in the payload.
 * Couple-shaped payloads carry the wedding under `event_date`; event
 * rows carry their own date under `date`, hence the field parameter.
 */
export function daysUntilEventMatches(
  payload: Record<string, unknown>,
  op: ComparisonOp | undefined,
  value: number | undefined,
  field: string = 'event_date',
): boolean {
  if (op === undefined || value === undefined) return true
  const raw = payload[field]
  return daysFromNowMatches(raw ? String(raw) : null, op, value)
}

/**
 * The wedding-date filter family, shared by every trigger whose
 * payload carries an `event_date`.
 *
 * Optionals are spelled `?: T | undefined` so a caller passing a
 * `z.infer`-derived config still satisfies this under
 * `exactOptionalPropertyTypes`; Zod always emits the `| undefined`.
 */
export interface EventDateConfig {
  hasEventDate?: boolean | undefined
  dayOfWeek?: DayOfWeekBucket | undefined
  eventMonth?: string | undefined
  season?: string | undefined
}

/**
 * Apply the has-a-date / day / month / season filters to a payload
 * carrying `event_date`. Absent filters match everything.
 *
 * The date-derived three are strict about a missing date: a couple
 * with no wedding date yet hasn't got a December wedding, so it must
 * not match one.
 */
export function eventDateMatches(
  payload: Record<string, unknown>,
  config: EventDateConfig,
  field: string = 'event_date',
): boolean {
  const eventDate = payload[field] ? String(payload[field]) : null

  if (config.hasEventDate !== undefined && config.hasEventDate !== Boolean(eventDate)) {
    return false
  }
  if (config.dayOfWeek && config.dayOfWeek !== 'any') {
    if (!eventDate) return false
    if (!dateMatchesDayOfWeek(eventDate, config.dayOfWeek)) return false
  }
  if (config.eventMonth && monthOfDate(eventDate) !== config.eventMonth) return false
  if (config.season && config.season !== 'any' && seasonOfDate(eventDate) !== config.season) {
    return false
  }
  return true
}

/**
 * Zod fragments for the shared filter families. Spread these into a
 * spec's `z.object({...})` rather than redeclaring the fields, so
 * every trigger agrees on the config keys the chip UI writes.
 */
export const eventDateConfigShape = {
  hasEventDate: z.boolean().optional(),
  dayOfWeek: z.enum(DAY_OF_WEEK_BUCKETS).optional(),
  // `''` is the inspector's "added but nothing chosen yet" value;
  // MONTHS has no neutral member the way the other enums have 'any'.
  eventMonth: z.union([z.enum(MONTHS), z.literal('')]).optional(),
  season: z.enum(SEASONS).optional(),
}

export const daysUntilEventShape = {
  daysUntilEventOp: z.enum(COMPARISON_OPS).optional(),
  daysUntilEventValue: z.number().int().optional(),
}
