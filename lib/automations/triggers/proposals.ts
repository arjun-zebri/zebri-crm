/**
 * Proposal triggers (roadmap R2, spec 5.2).
 *
 * The five lifecycle triggers are emitted by `tg_proposals_emit_lifecycle`
 * (migration `20261002000000_proposal_lifecycle_events.sql`), one per
 * old-to-new transition on `proposals`; `proposal_expiring` is emitted by
 * the tick (`lib/automations/time-emitters/proposal-expiring.ts`) with
 * the lead time it fired for in `payload.days_until_expiry`.
 *
 * Every payload carries the couple's `event_date`, so the specs share the
 * contract triggers' chips: the wedding-date family. No option or package
 * filter until R3 seeds real options (decision L9).
 *
 * Kept out of `../triggers` because that file is already 1,800 lines; the
 * registry spreads {@link proposalTriggers} in.
 *
 * @module lib/automations/triggers/proposals
 */

import { z } from 'zod'

import type { AutomationEventRow, TriggerType } from '@/types/automations'

import type { TriggerSpec } from '../triggers'

import {
  daysUntilEventMatches,
  daysUntilEventShape,
  eventDateConfigShape,
  eventDateMatches,
} from './event-date'

/** The trigger types this module owns. */
export type ProposalTriggerType = Extract<
  TriggerType,
  | 'proposal_sent'
  | 'proposal_opened'
  | 'proposal_accepted'
  | 'proposal_declined'
  | 'proposal_expired'
  | 'proposal_expiring'
>

/** Untyped payload read that is safe inside `match()` bodies. */
function payloadOf(event: AutomationEventRow): Record<string, unknown> {
  return (event.payload as Record<string, unknown>) ?? {}
}

/**
 * Shared schema for the lifecycle triggers: the wedding-date family and
 * nothing else. `.passthrough()` so a config saved with a key this
 * version does not know still parses rather than killing the workflow.
 */
export const proposalFilterSchema = z
  .object({
    ...daysUntilEventShape,
    ...eventDateConfigShape,
  })
  .passthrough()

export type ProposalFilterConfig = z.infer<typeof proposalFilterSchema>

/** Shared matcher: every proposal trigger narrows on the wedding date. */
export function proposalMatch(event: AutomationEventRow, config: ProposalFilterConfig): boolean {
  const payload = payloadOf(event)
  if (!daysUntilEventMatches(payload, config.daysUntilEventOp, config.daysUntilEventValue)) {
    return false
  }
  return eventDateMatches(payload, config)
}

function lifecycle(
  type: ProposalTriggerType,
  ui: TriggerSpec['ui'],
): TriggerSpec<ProposalFilterConfig> {
  return { type, configSchema: proposalFilterSchema, match: proposalMatch, ui }
}

/**
 * `proposal_expiring` adds the lead time. 3 days is the default because
 * a nudge on the day itself is too late for a couple to act on, and 60
 * is the ceiling because proposals rarely stay open longer than that.
 */
export const proposalExpiringConfig = z
  .object({
    days: z.number().int().min(0).max(60).default(3),
    ...daysUntilEventShape,
    ...eventDateConfigShape,
  })
  .passthrough()

export type ProposalExpiringConfig = z.infer<typeof proposalExpiringConfig>

const proposalExpiring: TriggerSpec<ProposalExpiringConfig> = {
  type: 'proposal_expiring',
  configSchema: proposalExpiringConfig,
  // The emitter stamps the lead time it fired for; narrowing on it means
  // a workflow with `days: 3` answers the 3-days-before event only, not
  // the `days: 0` event on the same proposal (the invoice_due lesson).
  match(event, config) {
    const emitted = Number(payloadOf(event).days_until_expiry)
    if (!Number.isFinite(emitted) || emitted !== config.days) return false
    return proposalMatch(event, config)
  },
  ui: {
    category: 'proposal',
    label: 'Proposal expiring',
    description: 'A set number of days before a proposal expires unanswered',
    icon: 'Hourglass',
  },
}

/**
 * The six specs, keyed by type, for the registry to spread in.
 *
 * The `match` param is contravariant, so a typed `TriggerSpec<Config>`
 * cannot be widened to `TriggerSpec<unknown>` (mirrors `triggerRegistry`'s
 * own typing in `../triggers` and `extendedActions` in
 * `../actions/extended`): the explicit `any` here is intentional.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const proposalTriggers: Record<ProposalTriggerType, TriggerSpec<any>> = {
  proposal_sent: lifecycle('proposal_sent', {
    category: 'proposal',
    label: 'Proposal sent',
    description: 'When a proposal is emailed to the couple',
    icon: 'Send',
  }),
  proposal_opened: lifecycle('proposal_opened', {
    category: 'proposal',
    label: 'Proposal opened',
    description: 'The first time the couple opens a proposal',
    icon: 'Eye',
  }),
  proposal_accepted: lifecycle('proposal_accepted', {
    category: 'proposal',
    label: 'Proposal accepted',
    description: 'When the couple accepts a proposal and signs',
    icon: 'CircleCheck',
  }),
  proposal_declined: lifecycle('proposal_declined', {
    category: 'proposal',
    label: 'Proposal declined',
    description: 'When the couple declines a proposal',
    icon: 'XCircle',
  }),
  proposal_expired: lifecycle('proposal_expired', {
    category: 'proposal',
    label: 'Proposal expired',
    description: 'When a proposal passes its expiry without an answer',
    icon: 'CalendarX',
  }),
  proposal_expiring: proposalExpiring,
}
