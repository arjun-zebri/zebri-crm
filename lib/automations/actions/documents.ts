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
import { accountPausedSleep, openAutomationSend } from '@/lib/email/automation-send'
import { dispatchEmail, type DispatchResult } from '@/lib/email/dispatch'
import { wrapAutomationShell } from '@/lib/email/html'
import { alertPartialSendFailure } from '@/lib/email/partial-send-alert'
import type { ResolvedSender } from '@/lib/email/sender-identity'
import { createAdminClient } from '@/lib/supabase/admin'
import { readAccountPause } from '@/lib/workflows/account-pause'
import type { ActionResult, ActionType, RunContext } from '@/types/automations'

import { resolveStepSender } from './step-sender'

import type { ActionSpec } from './index'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.zebri.com.au'

/**
 * Best-effort send of the run-sheet link to the MC. Returns the
 * transport's answer so the step can count a failed copy (Task 31) rather
 * than only saying whether anything went.
 * Emailing is intentionally non-fatal: the run-sheet link is the
 * primary output, and it's also returned to the run for the audit log.
 * No `RESEND_API_KEY` (e.g. in integration tests) comes back as a
 * failure, never a throw.
 */
async function emailRunSheetLink(
  to: string[],
  coupleName: string,
  url: string,
  sender: ResolvedSender,
): Promise<DispatchResult> {
  // dispatchEmail never throws and returns ok:false when the transport
  // isn't configured (e.g. no RESEND_API_KEY in integration tests).
  return dispatchEmail(sender, {
    to,
    subject: `Run sheet - ${coupleName}`,
    html: `<p>Here's the run sheet for ${coupleName}.</p><p><a href="${url}">Open the run sheet</a></p><p>${url}</p>`,
  })
}

/**
 * The account-wide workflow stop, for the two sends that do not go
 * through the shared gate (`sendContractEmail` / `sendInvoiceEmail`
 * dispatch directly). Checked first, before the share token is switched
 * on or `email_sent_at` stamped: a step the executor claimed a moment
 * before the stop must leave nothing behind, not a live link with no
 * email. Returns the result to hand back, or null to carry on. Skipped
 * for the MC's own Run now. A failed read is a retryable error, like
 * the gate's `check_failed`.
 */
async function accountStopHold(ctx: RunContext): Promise<ActionResult | null> {
  if (ctx.manualRun) return null
  const stop = await readAccountPause(createAdminClient(), ctx.userId)
  if (stop.status === 'paused') return accountPausedSleep()
  if (stop.status === 'unknown') {
    return {
      kind: 'error',
      message: `could not check the account-wide workflow stop (${stop.reason})`,
      recoverable: true,
    }
  }
  return null
}

// ────────────────────────────────────────────────────────────────
// send_contract
// ────────────────────────────────────────────────────────────────

// Only `contractId` remains: the handler sends the contract as saved,
// so the old templateId / signersRequired / expiryDays / customMessage
// fields were declared and never read (signers and expiry belong to
// the contract itself, and the email's copy is `contractHtml`'s).
// Passthrough keeps configs saved against them parsing.
const sendContractSchema = z.object({
  contractId: z.string().uuid().optional(),
}).passthrough()

const sendContract: ActionSpec<z.infer<typeof sendContractSchema>> = {
  type: 'send_contract',
  configSchema: sendContractSchema,
  async handler(ctx, config) {
    const held = await accountStopHold(ctx)
    if (held) return held
    if (!ctx.couple?.email) return { kind: 'ok', output: { skipped: 'no primary email' } }
    const supabase = createAdminClient()
    const contract = await pickContract(supabase, ctx, config.contractId)
    if (!contract) return { kind: 'ok', output: { skipped: 'no contract found' } }
    // Before anything is written: an unreachable mailbox stops the step.
    const resolved = await resolveStepSender(supabase, ctx, 'send_contract')
    if (!resolved.ok) return resolved.result
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
      contractTitle: contract.title ?? `Contract ${contract.contract_number}`,
      shareUrl: url,
      mcBusinessName: ctx.mc.businessName,
      expiresAt: contract.expires_at ?? null,
      sender: resolved.sender,
      userId: ctx.userId,
    })
    return { kind: 'ok', output: { contract_id: contract.id, contract_link: url } }
  },
  ui: { category: 'payments', label: 'Send contract', description: 'Email the couple a contract for signing', icon: 'FileSignature' },
}

// ────────────────────────────────────────────────────────────────
// send_invoice
// ────────────────────────────────────────────────────────────────

// Only `invoiceId` remains: the handler re-sends the invoice as
// saved, so the old paymentMethods / dueInDays / latePaymentFeePercent
// / customMessage fields were never read. Passthrough keeps configs
// saved against them parsing.
const sendInvoiceSchema = z.object({
  invoiceId: z.string().uuid().optional(),
}).passthrough()

const sendInvoice: ActionSpec<z.infer<typeof sendInvoiceSchema>> = {
  type: 'send_invoice',
  configSchema: sendInvoiceSchema,
  async handler(ctx, config) {
    // Also covers trigger_payment_reminder, which delegates here.
    const held = await accountStopHold(ctx)
    if (held) return held
    if (!ctx.couple?.email) return { kind: 'ok', output: { skipped: 'no primary email' } }
    const supabase = createAdminClient()
    const invoice = await pickInvoice(supabase, ctx, config.invoiceId)
    if (!invoice) return { kind: 'ok', output: { skipped: 'no invoice found' } }
    // Before anything is written: an unreachable mailbox stops the step.
    const resolved = await resolveStepSender(supabase, ctx, 'send_invoice')
    if (!resolved.ok) return resolved.result
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
      sender: resolved.sender,
      userId: ctx.userId,
    })
    return { kind: 'ok', output: { invoice_id: invoice.id, invoice_link: url } }
  },
  ui: { category: 'payments', label: 'Send invoice', description: 'Email the couple an invoice', icon: 'Receipt' },
}

// ────────────────────────────────────────────────────────────────
// trigger_payment_reminder
// ────────────────────────────────────────────────────────────────

// The old tone / escalationLevel / attachLateFeeNotice fields are
// gone: the handler delegates straight to send_invoice and never read
// them. Passthrough keeps configs saved against them parsing.
const triggerPaymentReminderSchema = sendInvoiceSchema

const triggerPaymentReminder: ActionSpec<z.infer<typeof triggerPaymentReminderSchema>> = {
  type: 'trigger_payment_reminder',
  configSchema: triggerPaymentReminderSchema,
  async handler(ctx, config) {
    return sendInvoice.handler(ctx, config)
  },
  ui: { category: 'payments', label: 'Send payment reminder', description: "Re-send the couple's most recent invoice", icon: 'AlertTriangle' },
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
    // The sender first, as send_contract and send_invoice do: a mailbox
    // that cannot be reached errors the step before the run-sheet link is
    // switched on, so nothing is shared for a send that never happened (R3).
    const resolved = await resolveStepSender(supabase, ctx, 'generate_run_sheet_pdf')
    if (!resolved.ok) return resolved.result
    const sender = resolved.sender
    if (!ev.share_token_enabled) {
      await supabase.from('events').update({ share_token_enabled: true } as never).eq('id', ev.id)
    }

    const url = `${APP_URL}/timeline/${ev.share_token}`

    // The couple's copy is an automated send to the couple, so it goes
    // through the gate: the opt-out check, the rate limit, and (commercial
    // by the classification's default) the unsubscribe link and header.
    // It is gated BEFORE the MC's copy goes out, so a deferral here re-runs
    // a step that has not yet mailed anyone. The MC's own copy is a
    // message to themselves and stays a plain send.
    let coupleEmailed = false
    let coupleSkipped: string | undefined
    // Counted across both copies, so a failed one shows on the step as
    // the partial-send warning (lib/workflows/send-outcome) instead of
    // hiding behind `emailed: true` from the other.
    let sent = 0
    let failed = 0
    let lastError: string | null = null
    let lastErrorCode: string | null = null
    const recordFailure = (error: string | undefined, code: string | undefined) => {
      failed += 1
      lastError = error ?? 'unknown send error'
      lastErrorCode = code ?? null
    }
    const coupleEmail = config.sendToCouple ? ctx.couple.email : null
    if (coupleEmail) {
      const gate = await openAutomationSend({
        actionType: 'generate_run_sheet_pdf',
        userId: ctx.userId,
        manualRun: ctx.manualRun,
        instanceId: ctx.instanceId,
        coupleId: ctx.couple.id,
        recipients: [{ to: coupleEmail, isCouple: true }],
        sender,
      })
      if (gate.kind === 'deferred') return gate.sleep
      if (gate.kind === 'check_failed') {
        return { kind: 'error', message: `generate_run_sheet_pdf: ${gate.error}`, recoverable: true }
      }
      const businessName = ctx.mc.businessName
      const coupleName = ctx.couple.name
      const res = await gate.send({
        stepId: ctx.stepId,
        to: coupleEmail,
        subject: `Run sheet for ${coupleName}`,
        render: (unsubscribeUrl) =>
          wrapAutomationShell(
            `Here's the run sheet for ${coupleName}.`,
            businessName,
            { label: 'Open the run sheet', url },
            ctx.mc.branding,
            unsubscribeUrl,
          ),
        identity: { businessName, branding: ctx.mc.branding },
        replyTo: ctx.mc.email,
        fingerprint: { action: 'generate_run_sheet_pdf', url },
      })
      // Emailing stays best-effort, as it always was: the link is the
      // step's primary output. A transport failure is reported, not fatal.
      coupleEmailed = res.ok && !res.skipped
      coupleSkipped = res.skipped
      if (coupleEmailed) sent += 1
      else if (!res.ok) recordFailure(res.error, res.code)
    }

    let mcEmailed = false
    if (ctx.mc.email) {
      const res = await emailRunSheetLink([ctx.mc.email], ctx.couple.name, url, sender)
      mcEmailed = res.ok
      if (res.ok) sent += 1
      else recordFailure(res.error, res.code)
    }
    const emailed = mcEmailed || coupleEmailed

    // Still ok when a copy failed: the link is the step's output, and
    // re-running would re-send the copy that did go. Alerted instead.
    // When both copies failed (sent 0) this still reads "Sent to 0 of 2"
    // and raises the partial alert rather than erroring: emailing is
    // best-effort for this action by design, and the counts say plainly
    // that nothing went.
    if (failed > 0) {
      await alertPartialSendFailure({
        userId: ctx.userId,
        coupleId: ctx.couple.id,
        stepId: ctx.stepId,
        instanceId: ctx.instanceId,
        actionType: 'generate_run_sheet_pdf',
        sent,
        failed,
        code: lastErrorCode,
      })
    }

    return {
      kind: 'ok',
      output: {
        run_sheet_link: url,
        event_id: ev.id,
        emailed,
        ...(coupleSkipped ? { couple_skipped: coupleSkipped } : {}),
        ...(failed > 0
          ? {
              sent,
              failed,
              ...(lastError ? { last_error: lastError } : {}),
              ...(lastErrorCode ? { last_error_code: lastErrorCode } : {}),
            }
          : {}),
      },
    }
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
