/**
 * Shared constants for the couple profile → Automations tab.
 *
 * Split out so the orchestrator ({@link CoupleAutomations}) and the
 * activity feed ({@link CoupleAutomationsFeed}) agree on run-status
 * tones without a circular import.
 *
 * @module app/(dashboard)/couples/couple-automations-shared
 */
import type { StatePillTone } from '@/components/ui/state-pill'
import type { RunStatus } from '@/types/automations'

/** Run status → StatePill tone. Live states lean warning/info. */
export const STATUS_TONE: Record<RunStatus, StatePillTone> = {
  running: 'info',
  waiting: 'warning',
  paused: 'warning',
  completed: 'success',
  errored: 'danger',
  cancelled: 'neutral',
}

/** Live states take priority on the collapsed automation row, in this order. */
export const HEADLINE_PRIORITY: RunStatus[] = ['running', 'waiting', 'paused']
