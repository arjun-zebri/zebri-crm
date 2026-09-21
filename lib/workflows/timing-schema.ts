/**
 * The one Zod schema for {@link StepTiming}.
 *
 * Three writers put a timing into `workflow_template_steps.timing`: the
 * builder's inspector, the AI copilot and the converter. Until this
 * module they validated three different ways (the copilot strictly, the
 * builder not at all), and the engine's `toStepTiming` quietly coerced
 * whatever landed. One schema, one set of rules:
 *
 * - `minutes` is a unit on the two delay modes only, in steps of
 *   {@link MINUTE_STEP}, because the tick runs every 15 minutes and a
 *   promise of "7 minutes" would be a lie.
 * - `sendTime` is `HH:MM` on the same grid and only rides on a calendar
 *   unit. "30 minutes after start, at 9am" is a contradiction.
 *
 * Plain module, no `'use server'`: Zod schemas must never be exported
 * from a server-action file (`use_server_value_exports`).
 *
 * @module lib/workflows/timing-schema
 */
import { z } from 'zod'

import type { StepTiming } from '@/types/workflows'

/** `HH:MM`, 24-hour, minutes in {00, 15, 30, 45}. */
export const SEND_TIME_PATTERN = /^([01]\d|2[0-3]):(00|15|30|45)$/

/** The tick cadence, and so the finest delay the model offers. */
export const MINUTE_STEP = 15

/**
 * The largest amount the schema accepts, on any unit. Shared with the
 * inspector's `withAmount` so the UI can never produce a value the
 * schema then refuses.
 */
export const MAX_AMOUNT = 999

const amount = z.number().int().min(0).max(MAX_AMOUNT)
const sendTime = z
  .string()
  .regex(SEND_TIME_PATTERN, 'Send time must be HH:MM on a 15-minute grid')
  .optional()

const SUB_DAY = new Set(['minutes', 'hours'])

/**
 * Validates a raw {@link StepTiming} candidate. See the module doc for the
 * cross-field rules (`sendTime` needs a calendar unit; `minutes` must land
 * on the 15-minute grid) enforced in `superRefine` below.
 */
export const stepTimingSchema = z
  .discriminatedUnion('mode', [
    z.object({
      mode: z.literal('wedding_relative'),
      direction: z.enum(['before', 'after']),
      amount,
      unit: z.enum(['days', 'weeks', 'months']),
      sendTime,
    }),
    z.object({
      mode: z.literal('apply_relative'),
      amount,
      unit: z.enum(['minutes', 'hours', 'days', 'weeks', 'months']),
      sendTime,
    }),
    z.object({
      mode: z.literal('after_previous'),
      delayAmount: amount,
      unit: z.enum(['minutes', 'hours', 'days']),
      // Declared (rather than left to the default key-strip) so a
      // sendTime on this mode is a validation error, not a silent drop:
      // "after the step above" has no calendar day to hang a time on.
      sendTime: z.never().optional(),
    }),
  ])
  .superRefine((t, ctx) => {
    if (t.mode !== 'after_previous' && t.sendTime && SUB_DAY.has(t.unit)) {
      ctx.addIssue({
        code: 'custom',
        path: ['sendTime'],
        message: 'A send time needs a delay in days or longer',
      })
    }
    const n = t.mode === 'after_previous' ? t.delayAmount : t.amount
    if (t.unit === 'minutes' && n % MINUTE_STEP !== 0) {
      ctx.addIssue({
        code: 'custom',
        path: [t.mode === 'after_previous' ? 'delayAmount' : 'amount'],
        message: `Minutes must be a multiple of ${MINUTE_STEP}`,
      })
    }
  })

/** Parse unknown input into a {@link StepTiming}, with a one-line error. */
export function parseStepTiming(
  raw: unknown,
): { ok: true; timing: StepTiming } | { ok: false; error: string } {
  const parsed = stepTimingSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') }
  }
  return { ok: true, timing: parsed.data as StepTiming }
}
