/**
 * Timeline-related actions.
 *
 * create_timeline_event       - insert a row into timeline_items
 * update_timeline_event       - update an existing row
 * send_timeline_to_vendors    - email vendor contacts with a link
 *                               to the read-only vendor timeline
 * send_final_run_sheet        - email primary + vendors the final
 *                               run sheet (essentially a styled
 *                               timeline + venue summary)
 *
 * @module lib/automations/actions/timeline
 */

import { Resend } from 'resend'
import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult, ActionType, RunContext } from '@/types/automations'

import { resolveRecipients } from '../recipients'
import { renderTemplate } from '../variables'

import { wrapAutomationHtml } from './messaging'
import type { ActionSpec } from './index'

let _resend: Resend | undefined
function resend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY is not set')
    _resend = new Resend(key)
  }
  return _resend
}

const FROM = 'Zebri <noreply@app.zebri.com.au>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.zebri.com.au'

// ────────────────────────────────────────────────────────────────
// create_timeline_event
// ────────────────────────────────────────────────────────────────

const createTimelineEventSchema = z.object({
  eventId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  startTime: z.string().optional(),
  durationMin: z.number().int().min(0).optional(),
  // The old category / responsibleVendor / cue / bufferAfterMin
  // fields were declared but never read — timeline_items has no such
  // columns. Passthrough keeps configs saved against them parsing.
}).passthrough()

const createTimelineEvent: ActionSpec<z.infer<typeof createTimelineEventSchema>> = {
  type: 'create_timeline_event',
  configSchema: createTimelineEventSchema,
  async handler(ctx, config) {
    const supabase = createAdminClient()
    const eventId = config.eventId ?? (await pickEventId(supabase, ctx))
    if (!eventId) return { kind: 'error', message: 'no event id (couple has no event yet)' }
    const { data, error } = await supabase
      .from('timeline_items')
      .insert({
        event_id: eventId,
        user_id: ctx.userId,
        title: renderTemplate(config.title, ctx),
        description: config.description ? renderTemplate(config.description, ctx) : null,
        start_time: config.startTime ?? null,
        duration_min: config.durationMin ?? null,
        position: Date.now() % 100_000,
      } as never)
      .select('id')
      .single()
    if (error || !data) return { kind: 'error', message: error?.message ?? 'failed' }
    return { kind: 'ok', output: { timeline_item_id: data.id } }
  },
  ui: { category: 'couple', label: 'Create timeline event', description: 'Add an item to the event timeline', icon: 'Clock' },
}

const updateTimelineEventSchema = z.object({
  timelineItemId: z.string().uuid(),
  title: z.string().optional(),
  description: z.string().optional(),
  startTime: z.string().optional(),
  durationMin: z.number().int().min(0).optional(),
  /** Shift this item and every later item by a duration. */
  shiftBy: z.object({
    amount: z.number().int(),
    unit: z.enum(['minutes', 'hours']),
  }).optional(),
  /** Auto-notify impacted vendor contacts when this changes. */
  notifyVendors: z.boolean().optional(),
}).passthrough()

const updateTimelineEvent: ActionSpec<z.infer<typeof updateTimelineEventSchema>> = {
  type: 'update_timeline_event',
  configSchema: updateTimelineEventSchema,
  async handler(ctx, config) {
    const supabase = createAdminClient()
    const patch: Record<string, unknown> = {}
    if (config.title) patch.title = renderTemplate(config.title, ctx)
    if (config.description) patch.description = renderTemplate(config.description, ctx)
    if (config.startTime != null) patch.start_time = config.startTime
    if (config.durationMin != null) patch.duration_min = config.durationMin
    const { error } = await supabase
      .from('timeline_items')
      .update(patch as never)
      .eq('id', config.timelineItemId)
      .eq('user_id', ctx.userId)
    if (error) return { kind: 'error', message: error.message }
    return { kind: 'ok' }
  },
  ui: { category: 'couple', label: 'Update timeline event', description: 'Edit a timeline item', icon: 'Pencil' },
}

// ────────────────────────────────────────────────────────────────
// send_timeline_to_vendors
// ────────────────────────────────────────────────────────────────

/**
 * Config for the merged "Send run sheet" action.
 *
 * The recipient flags absorb two other picker entries that shared this
 * handler's behaviour: `send_final_run_sheet` (vendors, with the MC's
 * message silently replaced by canned copy) and
 * `generate_run_sheet_pdf` (the MC + optionally the couple). One
 * action, three checkboxes. Vendors default on so a config saved
 * before the merge — which has no flags — keeps doing exactly what it
 * did.
 */
const sendTimelineToVendorsSchema = z.object({
  eventId: z.string().uuid().optional(),
  message: z
    .string()
    .min(1)
    .default('Here is the latest timeline for {{couple.name}} on {{event.date | friendly}}. Please review and let me know if anything looks off.'),
  sendToVendors: z.boolean().default(true),
  sendToCouple: z.boolean().default(false),
  sendToMe: z.boolean().default(false),
  // The old vendorFilter / format / ccCouple / attachRunSheet /
  // requireConfirmation fields were declared but never read — the
  // handler emails every vendor contact the same link. Passthrough
  // keeps configs saved against them parsing.
}).passthrough()

const sendTimelineToVendors: ActionSpec<z.infer<typeof sendTimelineToVendorsSchema>> = {
  type: 'send_timeline_to_vendors',
  configSchema: sendTimelineToVendorsSchema,
  async handler(ctx, config) {
    if (!ctx.couple) return { kind: 'error', message: 'no couple in context' }
    const supabase = createAdminClient()
    const eventId = config.eventId ?? (await pickEventId(supabase, ctx))
    if (!eventId) return { kind: 'ok', output: { skipped: 'no event' } }
    const { data: event } = await supabase
      .from('events')
      .select('share_token, share_token_enabled')
      .eq('id', eventId)
      .single()
    if (!event?.share_token) return { kind: 'error', message: 'event has no share token' }
    if (!event.share_token_enabled) {
      await supabase.from('events').update({ share_token_enabled: true } as never).eq('id', eventId)
    }
    const url = `${APP_URL}/timeline/${event.share_token}`

    const emails = new Set<string>()
    if (config.sendToVendors) {
      const vendors = await resolveRecipients(supabase, ctx.couple, { roles: ['vendor'], fallback: 'skip' })
      for (const v of vendors) if (v.email) emails.add(v.email)
    }
    if (config.sendToCouple && ctx.couple.email) emails.add(ctx.couple.email)
    if (config.sendToMe && ctx.mc.email) emails.add(ctx.mc.email)
    if (emails.size === 0) return { kind: 'ok', output: { skipped: 'no recipients' } }

    const body = renderTemplate(config.message, ctx) + `\n\n${url}`
    let sent = 0
    for (const to of emails) {
      await resend().emails.send({
        from: FROM,
        to,
        subject: `Run sheet for ${ctx.couple.name} - ${ctx.mc.businessName}`,
        html: wrapAutomationHtml(body, ctx),
        replyTo: ctx.mc.email,
      })
      sent += 1
    }
    return { kind: 'ok', output: { sent, run_sheet_link: url } }
  },
  ui: { category: 'couple', label: 'Send run sheet', description: 'Email the run sheet (timeline) link to vendors, the couple, or yourself', icon: 'Send' },
}

// ────────────────────────────────────────────────────────────────
// send_final_run_sheet
// ────────────────────────────────────────────────────────────────

const sendFinalRunSheet: ActionSpec<z.infer<typeof sendTimelineToVendorsSchema>> = {
  type: 'send_final_run_sheet',
  configSchema: sendTimelineToVendorsSchema,
  async handler(ctx, config) {
    // 14a: route through the existing timeline-share URL. A
    // distinct PDF-rendered run sheet is the follow-up
    // generate_run_sheet_pdf surface; this action focuses on the
    // delivery - couple + vendors.
    return sendTimelineToVendors.handler(ctx, {
      ...config,
      message: 'Final run sheet for {{couple.name}} - {{event.date | friendly}}. Save this link.',
    })
  },
  ui: { category: 'post_event', label: 'Send final run sheet', description: 'Send the final event run sheet to couple + vendors', icon: 'ClipboardList' },
}

async function pickEventId(
  supabase: ReturnType<typeof createAdminClient>,
  ctx: RunContext,
): Promise<string | null> {
  if (!ctx.couple) return null
  const payload = (ctx.triggerEvent.payload as Record<string, unknown>) ?? {}
  if (typeof payload['event_id'] === 'string') return payload['event_id'] as string
  const { data } = await supabase
    .from('events')
    .select('id')
    .eq('couple_id', ctx.couple.id)
    .order('date', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

export const timelineActions: Partial<Record<ActionType, ActionSpec<any>>> = {
  create_timeline_event: createTimelineEvent,
  update_timeline_event: updateTimelineEvent,
  send_timeline_to_vendors: sendTimelineToVendors,
  send_final_run_sheet: sendFinalRunSheet,
}
