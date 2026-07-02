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
import { extendedActions } from './extended'
import { messagingActions } from './messaging'
import { postEventActions } from './post-event'
import { questionnaireActions } from './questionnaire'
import { taskActions } from './task'
import { timelineActions } from './timeline'
import type { ActionUi } from './ui'

// `ActionUi` + the client-safe `actionUi` metadata catalogue live in
// `./ui` (no handler imports), so client components read action metadata
// without bundling the server-only handlers (and their nodemailer /
// node:crypto / service-role deps) into the browser.
export type { ActionUi } from './ui'

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
  ...questionnaireActions,
  ...timelineActions,
  ...postEventActions,
  // Phase 14a UI-only stubs (handlers throw a clear "not wired" error).
  ...extendedActions,
}

export function getActionSpec(type: ActionType): ActionSpec | null {
  return actionRegistry[type] ?? null
}
