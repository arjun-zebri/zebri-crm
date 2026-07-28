/**
 * Couple-scoped actions.
 *
 * update_couple_stage  - move the couple to a new pipeline status
 * add_note             - append text to couples.notes
 * update_custom_fields - upsert into couple_custom_fields
 * send_portal_link     - email the portal share link
 * request_information  - email a portal section deep-link
 * create_couple        - create a new couple from a manual fire
 * pause_couple_automations - pause every running automation for this couple
 *
 * @module lib/automations/actions/couple
 */

import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult, ActionType, RunContext } from '@/types/automations'

import { renderTemplate } from '../variables'

import { wrapAutomationHtml } from './messaging'
import type { ActionSpec } from './index'

import { Resend } from 'resend'

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
// update_couple_stage
// ────────────────────────────────────────────────────────────────

const updateStageSchema = z.object({
  toStatus: z.string().min(1),
  /** Guard rail — only run when the couple is currently in one of these statuses. */
  onlyIfCurrentStatus: z.array(z.string()).optional(),
  /** Auto-append a note to the couple recording why the move happened. */
  addNote: z.string().optional(),
}).passthrough()

const updateCoupleStage: ActionSpec<z.infer<typeof updateStageSchema>> = {
  type: 'update_couple_stage',
  configSchema: updateStageSchema,
  async handler(ctx, config) {
    if (!ctx.couple) return { kind: 'error', message: 'no couple in context' }
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('couples')
      .update({ status: config.toStatus })
      .eq('id', ctx.couple.id)
      .eq('user_id', ctx.userId)
    if (error) return { kind: 'error', message: error.message }
    return { kind: 'ok', output: { from_status: ctx.couple.status, to_status: config.toStatus } }
  },
  ui: { category: 'couple', label: 'Update couple stage', description: 'Move the couple to a new pipeline status', icon: 'ArrowRight' },
}

// ────────────────────────────────────────────────────────────────
// add_note
// ────────────────────────────────────────────────────────────────

const addNoteSchema = z.object({
  text: z.string().min(1),
  /** Bucket for filtering / dashboard surfaces. */
  category: z.enum(['general', 'admin', 'followup', 'risk', 'private']).optional(),
  /** Pin to the top of the couple's notes panel. */
  pinned: z.boolean().optional(),
  /** Whether this note can ever be shown to the couple (default: no). */
  visibleToCouple: z.boolean().optional(),
}).passthrough()

const addNote: ActionSpec<z.infer<typeof addNoteSchema>> = {
  type: 'add_note',
  configSchema: addNoteSchema,
  async handler(ctx, config) {
    if (!ctx.couple) return { kind: 'error', message: 'no couple in context' }
    const text = renderTemplate(config.text, ctx)
    const stamp = new Date().toISOString().slice(0, 10)
    const supabase = createAdminClient()
    const { data: row } = await supabase.from('couples').select('notes').eq('id', ctx.couple.id).single()
    const existing = row?.notes ?? ''
    const next = existing ? `${existing}\n\n[${stamp}] ${text}` : `[${stamp}] ${text}`
    const { error } = await supabase
      .from('couples')
      .update({ notes: next })
      .eq('id', ctx.couple.id)
      .eq('user_id', ctx.userId)
    if (error) return { kind: 'error', message: error.message }
    return { kind: 'ok', output: { note_appended: true } }
  },
  ui: { category: 'couple', label: 'Add note', description: 'Append a note to the couple', icon: 'StickyNote' },
}

// ────────────────────────────────────────────────────────────────
// update_custom_fields
// ────────────────────────────────────────────────────────────────

const updateCustomFieldsSchema = z.object({
  fields: z.array(z.object({ key: z.string().min(1), value: z.any() })).min(1),
  /** set / append / increment / only_if_unset. */
  mergeMode: z.enum(['set', 'append', 'increment', 'only_if_unset']).optional(),
  /** Don't overwrite values that are already set (alias of merge_mode = only_if_unset). */
  onlyIfUnset: z.boolean().optional(),
}).passthrough()

const updateCustomFields: ActionSpec<z.infer<typeof updateCustomFieldsSchema>> = {
  type: 'update_custom_fields',
  configSchema: updateCustomFieldsSchema,
  async handler(ctx, config) {
    if (!ctx.couple) return { kind: 'error', message: 'no couple in context' }
    const supabase = createAdminClient()
    const rows = config.fields.map((f) => ({
      couple_id: ctx.couple!.id,
      user_id: ctx.userId,
      key: f.key,
      value: f.value as never,
    }))
    const { error } = await supabase
      .from('couple_custom_fields' as never)
      .upsert(rows as never, { onConflict: 'couple_id,key' })
    if (error) return { kind: 'error', message: error.message }
    return { kind: 'ok', output: { updated: rows.length } }
  },
  ui: { category: 'couple', label: 'Update custom fields', description: 'Set values on per-couple custom fields', icon: 'Settings2' },
}

// ────────────────────────────────────────────────────────────────
// send_portal_link
// ────────────────────────────────────────────────────────────────

const sendPortalLinkSchema = z.object({
  message: z.string().min(1).default('Hi {{couple.primary_name}}, here is your event portal - please add your details when you have a moment.'),
  /** Subject line override (default is "Your event portal — {business_name}"). */
  subject: z.string().optional(),
  /** Burn the magic link after N days. */
  expiresInDays: z.number().int().min(1).max(365).optional(),
  /** Deep-link to one portal section only. */
  restrictToSection: z.enum(['onboarding', 'pre_event', 'day_of', 'people', 'songs', 'files', 'timeline']).optional(),
  /** Send to primary only, both partners, or one specifically. */
  magicLinkRecipient: z.enum(['primary', 'spouse', 'both']).optional(),
}).passthrough()

const sendPortalLink: ActionSpec<z.infer<typeof sendPortalLinkSchema>> = {
  type: 'send_portal_link',
  configSchema: sendPortalLinkSchema,
  async handler(ctx, config) {
    if (!ctx.couple) return { kind: 'error', message: 'no couple in context' }
    if (!ctx.couple.email) return { kind: 'ok', output: { skipped: 'no primary email' } }
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('couples')
      .select('portal_token, portal_token_enabled')
      .eq('id', ctx.couple.id)
      .single()
    if (!data?.portal_token) return { kind: 'error', message: 'couple has no portal token' }
    if (!data.portal_token_enabled) {
      await supabase.from('couples').update({ portal_token_enabled: true }).eq('id', ctx.couple.id)
    }
    const link = `${APP_URL}/portal/${data.portal_token}`
    const ctxWithLink: RunContext = {
      ...ctx,
      triggerEvent: {
        ...ctx.triggerEvent,
        payload: { ...(ctx.triggerEvent.payload as Record<string, unknown>), portal_link: link },
      },
    }
    const body = renderTemplate(config.message, ctxWithLink) + `\n\n${link}`
    await resend().emails.send({
      from: FROM,
      to: ctx.couple.email,
      subject: `Your event portal - ${ctx.mc.businessName}`,
      html: wrapAutomationHtml(body, ctx),
      replyTo: ctx.mc.email,
    })
    return { kind: 'ok', output: { portal_link: link } }
  },
  ui: { category: 'couple', label: 'Send portal access link', description: 'Share the couple portal link with the couple', icon: 'Link2' },
}

// ────────────────────────────────────────────────────────────────
// request_information
// ────────────────────────────────────────────────────────────────

const requestInformationSchema = z.object({
  section: z.enum(['onboarding', 'pre_event', 'day_of', 'people', 'songs', 'files', 'timeline']),
  message: z.string().min(1).default(
    "Hi {{couple.primary_name}}, when you have a moment could you fill in the next section of your event portal? It helps me prepare for the big day.",
  ),
  /** Date the MC needs this back by — shown in the email. */
  dueDate: z.string().optional(),
  /** none / weekly / every-2-days follow-up cadence if the couple ignores. */
  reminderCadence: z.enum(['none', 'weekly', 'two_day']).optional(),
  /** Auto-create an MC task if not completed within N days. */
  escalateAfterDays: z.number().int().min(1).max(60).optional(),
}).passthrough()

const requestInformation: ActionSpec<z.infer<typeof requestInformationSchema>> = {
  type: 'request_information',
  configSchema: requestInformationSchema,
  async handler(ctx, config) {
    if (!ctx.couple?.email) return { kind: 'ok', output: { skipped: 'no primary email' } }
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('couples')
      .select('portal_token')
      .eq('id', ctx.couple.id)
      .single()
    if (!data?.portal_token) return { kind: 'error', message: 'no portal token' }
    const link = `${APP_URL}/portal/${data.portal_token}#${config.section}`
    const body = renderTemplate(config.message, ctx) + `\n\n${link}`
    await resend().emails.send({
      from: FROM,
      to: ctx.couple.email,
      subject: `One step left - ${ctx.mc.businessName}`,
      html: wrapAutomationHtml(body, ctx),
      replyTo: ctx.mc.email,
    })
    return { kind: 'ok', output: { section: config.section } }
  },
  ui: { category: 'couple', label: 'Request information', description: 'Email the couple asking them to fill in a portal section', icon: 'MailQuestion' },
}

// ────────────────────────────────────────────────────────────────
// create_couple
// ────────────────────────────────────────────────────────────────

const createCoupleSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  eventDate: z.string().optional(),
  leadSource: z.string().optional(),
  eventType: z.string().optional(),
  venue: z.string().optional(),
  partnerName: z.string().optional(),
  assignTags: z.array(z.string()).optional(),
  /** Auto-create a "welcome call" task once the couple is added. */
  autoCreateTask: z.boolean().optional(),
  /** Skip creating duplicates if an existing couple shares the email. */
  dedupeOnEmail: z.boolean().optional(),
}).passthrough()

const createCouple: ActionSpec<z.infer<typeof createCoupleSchema>> = {
  type: 'create_couple',
  configSchema: createCoupleSchema,
  async handler(ctx, config) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('couples')
      .insert({
        user_id: ctx.userId,
        name: config.name,
        email: config.email ?? '',
        phone: config.phone ?? '',
        event_date: config.eventDate ?? null,
        venue: '',
        notes: '',
        status: 'new',
        lead_source: config.leadSource ?? null,
      } as never)
      .select('id')
      .single()
    if (error || !data) return { kind: 'error', message: error?.message ?? 'failed to create couple' }
    return { kind: 'ok', output: { couple_id: data.id } }
  },
  ui: { category: 'couple', label: 'Create couple', description: 'Add a new couple to your CRM', icon: 'UserPlus' },
}

// ────────────────────────────────────────────────────────────────
// pause_couple_automations
// ────────────────────────────────────────────────────────────────

const pauseCoupleAutomationsSchema = z.object({
  /** Auto-resume after N days (omit for indefinite pause). */
  pauseForDays: z.number().int().min(1).max(365).optional(),
  /** Free-text reason — surfaces in the audit log. */
  pauseReason: z.string().optional(),
  /** Bucket for filtering: general / cancellation / on_hold / postponed. */
  pauseCategory: z.enum(['general', 'cancellation', 'on_hold', 'postponed']).optional(),
}).passthrough()

const pauseCoupleAutomations: ActionSpec<z.infer<typeof pauseCoupleAutomationsSchema>> = {
  type: 'pause_couple_automations',
  configSchema: pauseCoupleAutomationsSchema,
  async handler(ctx) {
    if (!ctx.couple) return { kind: 'error', message: 'no couple in context' }
    const supabase = createAdminClient()
    const { error, count } = await supabase
      .from('automation_runs' as never)
      .update({ status: 'paused' } as never, { count: 'exact' })
      .eq('couple_id', ctx.couple.id)
      .eq('user_id', ctx.userId)
      .in('status', ['running', 'waiting'])
    if (error) return { kind: 'error', message: error.message }
    return { kind: 'ok', output: { paused_runs: count ?? 0 } }
  },
  ui: { category: 'flow', label: 'Pause this couple\'s automations', description: 'Halt every other running automation on this couple', icon: 'Pause' },
}

export const coupleActions: Partial<Record<ActionType, ActionSpec<any>>> = {
  update_couple_stage: updateCoupleStage,
  add_note: addNote,
  update_custom_fields: updateCustomFields,
  send_portal_link: sendPortalLink,
  request_information: requestInformation,
  create_couple: createCouple,
  pause_couple_automations: pauseCoupleAutomations,
}
