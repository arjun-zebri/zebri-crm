/**
 * Document-sharing actions.
 *
 * send_contract / send_invoice  flip share_token_enabled
 *                                            to true and send the
 *                                            corresponding email
 *                                            via the existing
 *                                            lib/email helpers.
 * trigger_payment_reminder                   re-send an invoice
 *                                            email
 * generate_run_sheet_pdf                     uses lib/pdf to render
 *                                            a run-sheet PDF and
 *                                            stash the URL on the
 *                                            run output
 *
 * @module lib/automations/actions/documents
 */

import { z } from 'zod'

import { sendContractEmail, sendInvoiceEmail } from '@/lib/email'
import { dispatchEmail } from '@/lib/email/dispatch'
import { resolveSender, type ResolvedSender } from '@/lib/email/sender-identity'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionType, RunContext } from '@/types/automations'

import type { ActionSpec } from './index'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.zebri.com.au'

/**
 * Best-effort send of the run-sheet link. Returns true if it went out.
 * Emailing is intentionally non-fatal — the run-sheet link is the
 * primary output, and it's also returned to the run for the audit log.
 * No `RESEND_API_KEY` (e.g. in integration tests) → skip silently.
 */
async function emailRunSheetLink(
  to: string[],
  coupleName: string,
  url: string,
  sender: ResolvedSender,
): Promise<boolean> {
  if (to.length === 0) return false
  // Best-effort: dispatchEmail never throws and returns ok:false when the
  // transport isn't configured (e.g. no RESEND_API_KEY in integration tests).
  const res = await dispatchEmail(sender, {
    to,
    subject: `Run sheet — ${coupleName}`,
    html: `<p>Here's the run sheet for ${coupleName}.</p><p><a href="${url}">Open the run sheet</a></p><p>${url}</p>`,
  })
  return res.ok
}

// ────────────────────────────────────────────────────────────────
// send_contract
// ────────────────────────────────────────────────────────────────

const sendContractSchema = z.object({
  contractId: z.string().uuid().optional(),
  templateId: z.string().optional(),
  signersRequired: z.enum(['primary', 'spouse', 'both']).optional(),
  expiryDays: z.number().int().min(1).max(365).optional(),
  customMessage: z.string().optional(),
}).passthrough()

const sendContract: ActionSpec<z.infer<typeof sendContractSchema>> = {
  type: 'send_contract',
  configSchema: sendContractSchema,
  async handler(ctx, config) {
    if (!ctx.couple?.email) return { kind: 'ok', output: { skipped: 'no primary email' } }
    const supabase = createAdminClient()
    const contract = await pickContract(supabase, ctx, config.contractId)
    if (!contract) return { kind: 'ok', output: { skipped: 'no contract found' } }
    if (!contract.share_token_enabled) {
      await supabase
        .from('contracts')
        .update({ share_token_enabled: true, email_sent_at: new Date().toISOString() } as never)
        .eq('id', contract.id)
    }
    const url = `${APP_URL}/contract/${contract.share_token}`
    await sendContractEmail({
      coupleEmail: ctx.couple.email,
      coupleName: ctx.couple.name,
      contractNumber: contract.contract_number,
      contractTitle: contract.title,
      shareUrl: url,
      mcBusinessName: ctx.mc.businessName,
      expiresAt: contract.expires_at ?? null,
      sender: await resolveSender(supabase, ctx.userId, ctx.mc.businessName),
    })
    return { kind: 'ok', output: { contract_id: contract.id, contract_link: url } }
  },
  ui: { category: 'payments', label: 'Send contract', description: 'Email the couple a contract for signing', icon: 'FileSignature' },
}

// ────────────────────────────────────────────────────────────────
// send_invoice
// ────────────────────────────────────────────────────────────────

const sendInvoiceSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  /** Toggle which payment methods are surfaced on the public invoice page. */
  paymentMethods: z.array(z.enum(['stripe_card', 'bank_transfer', 'cash', 'cheque', 'other'])).optional(),
  /** Override the due-in days. */
  dueInDays: z.number().int().min(0).max(365).optional(),
  /** Show a late-payment fee notice (%). */
  latePaymentFeePercent: z.number().min(0).max(100).optional(),
  customMessage: z.string().optional(),
}).passthrough()

const sendInvoice: ActionSpec<z.infer<typeof sendInvoiceSchema>> = {
  type: 'send_invoice',
  configSchema: sendInvoiceSchema,
  async handler(ctx, config) {
    if (!ctx.couple?.email) return { kind: 'ok', output: { skipped: 'no primary email' } }
    const supabase = createAdminClient()
    const invoice = await pickInvoice(supabase, ctx, config.invoiceId)
    if (!invoice) return { kind: 'ok', output: { skipped: 'no invoice found' } }
    if (!invoice.share_token_enabled) {
      await supabase.from('invoices').update({ share_token_enabled: true } as never).eq('id', invoice.id)
    }
    const url = `${APP_URL}/invoice/${invoice.share_token}`
    await sendInvoiceEmail({
      coupleEmail: ctx.couple.email,
      coupleName: ctx.couple.name,
      invoiceNumber: invoice.invoice_number,
      invoiceTitle: invoice.title,
      dueDate: invoice.due_date,
      shareUrl: url,
      mcBusinessName: ctx.mc.businessName,
      sender: await resolveSender(supabase, ctx.userId, ctx.mc.businessName),
    })
    return { kind: 'ok', output: { invoice_id: invoice.id, invoice_link: url } }
  },
  ui: { category: 'payments', label: 'Send invoice', description: 'Email the couple an invoice', icon: 'Receipt' },
}

// ────────────────────────────────────────────────────────────────
// trigger_payment_reminder
// ────────────────────────────────────────────────────────────────

const triggerPaymentReminderSchema = sendInvoiceSchema.extend({
  /** Friendly / firm / final escalation tone. */
  tone: z.enum(['friendly', 'firm', 'final']).optional(),
  /** Escalation level for tracking (1 → first nudge, 3 → final notice). */
  escalationLevel: z.number().int().min(1).max(5).optional(),
  /** Attach a separate late-fee notice PDF. */
  attachLateFeeNotice: z.boolean().optional(),
})

const triggerPaymentReminder: ActionSpec<z.infer<typeof triggerPaymentReminderSchema>> = {
  type: 'trigger_payment_reminder',
  configSchema: triggerPaymentReminderSchema,
  async handler(ctx, config) {
    return sendInvoice.handler(ctx, config)
  },
  ui: { category: 'payments', label: 'Send payment reminder', description: 'Re-send the most recent unpaid invoice', icon: 'AlertTriangle' },
}

// ────────────────────────────────────────────────────────────────
// generate_run_sheet_pdf
// ────────────────────────────────────────────────────────────────

const generateRunSheetSchema = z.object({
  /** The event to share. Defaults to the triggering event / the
   *  couple's earliest event. */
  eventId: z.string().uuid().optional(),
  /** Also email the link to the couple (default: MC only). */
  sendToCouple: z.boolean().optional(),
}).passthrough()

/** Resolve the event to share: config id → trigger payload → earliest. */
async function pickEventId(
  supabase: ReturnType<typeof createAdminClient>,
  ctx: RunContext,
  explicitId?: string,
): Promise<string | null> {
  if (explicitId) return explicitId
  const payload = (ctx.triggerEvent.payload as Record<string, unknown>) ?? {}
  if (typeof payload['event_id'] === 'string') return payload['event_id'] as string
  if (!ctx.couple) return null
  const { data } = await supabase
    .from('events')
    .select('id')
    .eq('couple_id', ctx.couple.id)
    .eq('user_id', ctx.userId)
    .order('date', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

/**
 * Share the event run sheet as a link. The "run sheet" is the event
 * timeline view (`/timeline/{share_token}`); a server-rendered PDF is
 * deferred (no server PDF stack yet — see automations-wiring.md). The
 * action enables the event share token, emails the MC (and optionally
 * the couple) the link, and returns it for the audit log.
 */
const generateRunSheetPdf: ActionSpec<z.infer<typeof generateRunSheetSchema>> = {
  type: 'generate_run_sheet_pdf',
  configSchema: generateRunSheetSchema,
  async handler(ctx, config) {
    if (!ctx.couple) return { kind: 'error', message: 'no couple in context' }
    const supabase = createAdminClient()
    const eventId = await pickEventId(supabase, ctx, config.eventId)
    if (!eventId) return { kind: 'ok', output: { skipped: 'no event found' } }

    const { data: event } = await supabase
      .from('events')
      .select('id, share_token, share_token_enabled')
      .eq('id', eventId)
      .eq('user_id', ctx.userId)
      .maybeSingle()
    const ev = event as { id: string; share_token: string | null; share_token_enabled: boolean } | null
    if (!ev?.share_token) {
      return { kind: 'error', message: 'event has no share token', recoverable: true }
    }
    if (!ev.share_token_enabled) {
      await supabase.from('events').update({ share_token_enabled: true } as never).eq('id', ev.id)
    }

    const url = `${APP_URL}/timeline/${ev.share_token}`
    const recipients = [
      ctx.mc.email,
      ...(config.sendToCouple && ctx.couple.email ? [ctx.couple.email] : []),
    ].filter(Boolean)
    const sender = await resolveSender(supabase, ctx.userId, ctx.mc.businessName)
    const emailed = await emailRunSheetLink(recipients, ctx.couple.name, url, sender)

    return { kind: 'ok', output: { run_sheet_link: url, event_id: ev.id, emailed } }
  },
  ui: { category: 'post_event', label: 'Send run sheet', description: 'Email a link to the event run sheet (timeline)', icon: 'ClipboardList' },
}

// ────────────────────────────────────────────────────────────────
// helpers - pick the row most-likely meant by the user
// ────────────────────────────────────────────────────────────────

async function pickContract(
  supabase: ReturnType<typeof createAdminClient>,
  ctx: RunContext,
  explicitId?: string,
) {
  if (explicitId) {
    const { data } = await supabase
      .from('contracts')
      .select('id, contract_number, title, share_token, share_token_enabled, expires_at')
      .eq('id', explicitId)
      .eq('user_id', ctx.userId)
      .single()
    return data ?? null
  }
  const payload = (ctx.triggerEvent.payload as Record<string, unknown>) ?? {}
  const idFromTrigger = typeof payload['contract_id'] === 'string' ? (payload['contract_id'] as string) : null
  if (idFromTrigger) return pickContract(supabase, ctx, idFromTrigger)
  if (!ctx.couple) return null
  const { data } = await supabase
    .from('contracts')
    .select('id, contract_number, title, share_token, share_token_enabled, expires_at')
    .eq('couple_id', ctx.couple.id)
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

async function pickInvoice(
  supabase: ReturnType<typeof createAdminClient>,
  ctx: RunContext,
  explicitId?: string,
) {
  if (explicitId) {
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, title, share_token, share_token_enabled, due_date')
      .eq('id', explicitId)
      .eq('user_id', ctx.userId)
      .single()
    return data ?? null
  }
  const payload = (ctx.triggerEvent.payload as Record<string, unknown>) ?? {}
  const idFromTrigger = typeof payload['invoice_id'] === 'string' ? (payload['invoice_id'] as string) : null
  if (idFromTrigger) return pickInvoice(supabase, ctx, idFromTrigger)
  if (!ctx.couple) return null
  const { data } = await supabase
    .from('invoices')
    .select('id, invoice_number, title, share_token, share_token_enabled, due_date')
    .eq('couple_id', ctx.couple.id)
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

export const documentActions: Partial<Record<ActionType, ActionSpec<any>>> = {
  send_contract: sendContract,
  send_invoice: sendInvoice,
  trigger_payment_reminder: triggerPaymentReminder,
  generate_run_sheet_pdf: generateRunSheetPdf,
}
