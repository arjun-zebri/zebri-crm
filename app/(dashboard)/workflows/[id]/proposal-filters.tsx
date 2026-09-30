/**
 * Filter chips for the proposal triggers (roadmap R2, spec 5.2).
 *
 * The five lifecycle triggers use `EVENT_DATE_FILTERS` directly (see
 * `apply-rule-card-body.tsx`). `proposal_expiring` has one required
 * parameter, the lead time, rendered with the same numeric control as
 * the invoice_due chip, plus the wedding-date family.
 *
 * @module app/(dashboard)/workflows/[id]/proposal-filters
 */
'use client'

import { EVENT_DATE_FILTERS } from './event-date-filters'
import { ComparisonControl } from './filter-controls'
import { fieldFilter, type FilterConfig, type TriggerFilterDef } from './filter-list'

/** Matches `proposalExpiringConfig` in `lib/automations/triggers/proposals.ts`. */
const DEFAULT_DAYS = 3
const MAX_DAYS = 60

/** Label for the lead time, e.g. "3 days before it expires". */
function expiryLeadLabel(config: FilterConfig): string {
  const days = typeof config['days'] === 'number' ? config['days'] : DEFAULT_DAYS
  return days === 0 ? 'on the day it expires' : `${days} day${days === 1 ? '' : 's'} before it expires`
}

/**
 * The lead time is the trigger's required parameter (which emitted event
 * this workflow answers), so its chip is permanent. The value is clamped
 * to the schema's range here so a typo cannot save a config the
 * dispatcher would reject, which is a silently dead workflow.
 */
const expiryLeadFilter: TriggerFilterDef = {
  key: 'days',
  label: 'When it fires',
  chipLabel: 'fires',
  required: true,
  ...fieldFilter({ days: DEFAULT_DAYS }),
  valueLabel: expiryLeadLabel,
  summary: (config) => `Fires ${expiryLeadLabel(config)}`,
  render: (config, setConfig) => (
    <ComparisonControl
      value={(config['days'] as number | undefined) ?? DEFAULT_DAYS}
      unit="days"
      hint="Days before the proposal expires. 0 fires on the day itself."
      onChange={(_op, value) =>
        setConfig({ ...config, days: Math.max(0, Math.min(MAX_DAYS, Math.floor(value))) })
      }
    />
  ),
}

/** Filters for Proposal expiring: the lead time, then the wedding date. */
export const PROPOSAL_EXPIRING_FILTERS: TriggerFilterDef[] = [expiryLeadFilter, ...EVENT_DATE_FILTERS]
