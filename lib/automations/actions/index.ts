/**
 * Action registry: one entry per action type the engine can perform.
 *
 * Action handlers are server-only. They receive the runner's
 * {@link RunContext} plus a parsed config object and return an
 * {@link ActionResult} describing the outcome.
 *
 * UI metadata lives alongside the handler so the builder's action
 * picker and inspector can render labels, icons, and category
 * groupings without a second mapping.
 *
 * Channel-specific actions (SMS, WhatsApp) are deferred to Phase
 * 14b: they appear in the registry as `comingSoon = true` so the
 * picker can render greyed-out tiles, but the runner refuses to
 * execute them and emits a clear error if a draft somehow slipped
 * past UI guards.
 *
 * @module lib/automations/actions
 */

import type { z } from 'zod'

import type { ActionResult, ActionType, RunContext } from '@/types/automations'

import { coupleActions } from './couple'
import { documentActions } from './documents'
import { messagingActions } from './messaging'
import { postEventActions } from './post-event'
import { taskActions } from './task'
import { timelineActions } from './timeline'

export interface ActionUi {
  category: 'general' | 'couple' | 'calendar' | 'payments' | 'post_event' | 'flow'
  label: string
  description: string
  icon: string
  /** Render the picker tile in a disabled "coming soon" state. */
  comingSoon?: boolean
  /** Pre-fill a label when the action is added (the user can rename). */
  defaultLabel?: string
}

export interface ActionSpec<Config = unknown> {
  type: ActionType
  configSchema: z.ZodSchema<Config>
  handler: (ctx: RunContext, config: Config) => Promise<ActionResult>
  ui: ActionUi
}

export const actionRegistry: Partial<Record<ActionType, ActionSpec<any>>> = {
  ...messagingActions,
  ...coupleActions,
  ...taskActions,
  ...documentActions,
  ...timelineActions,
  ...postEventActions,
}

export function getActionSpec(type: ActionType): ActionSpec | null {
  return actionRegistry[type] ?? null
}
