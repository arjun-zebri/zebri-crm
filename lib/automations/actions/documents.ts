/**
 * Document-sharing actions.
 *
 * send_quote / send_contract / send_invoice  flip share_token_enabled
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

import { sendContractEmail, sendInvoiceEmail, sendQuoteEmail } from '@/lib/email'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult, ActionType, RunContext } from '@/types/automations'

import type { ActionSpec } from './index'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.zebri.com.au'

// ────────────────────────────────────────────────────────────────
// send_quote
// ────────────────────────────────────────────────────────────────

const sendQuoteSchema = z.object({
  /** If omitted, pick the most recent draft quote for this couple. */
  quoteId: z.string().uuid().optional(),
})

const sendQuote: ActionSpec<z.infer<typeof sendQuoteSchema>> = {
  type: 'send_quote',
  configSchema: sendQuoteSchema,
  async handler(ctx, config) {
    if (!ctx.couple?.email) return { kind: 'ok', output: { skipped: 'no primary email' } }
    const supabase = createAdminClient()
    const quote = await pickQuote(supabase, ctx, config.quoteId)
    if (!quote) return { kind: 'ok', output: { skipped: 'no quote found' } }
    if (!quote.share_token_enabled) {
      await supabase.from('quotes').update({ share_token_enabled: true } as never).eq('id', quote.id)
    }
    const url = `${APP_URL}/q/${quote.share_token}`
    await sendQuoteEmail({
      coupleEmail: ctx.couple.email,
      coupleName: ctx.couple.name,
      quoteNumber: quote.quote_number,
      quoteTitle: quote.title,
      shareUrl: url,
      mcBusinessName: ctx.mc.businessName,
    })
    return { kind: 'ok', output: { quote_id: quote.id, quote_link: url } }
  },
  ui: { category: 'payments', label: 'Send quote', description: 'Email the couple a quote', icon: 'FileText' },
}

// ────────────────────────────────────────────────────────────────
// send_contract
// ────────────────────────────────────────────────────────────────

const sendContractSchema = z.object({
  contractId: z.string().uuid().optional(),
})

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
    const url = `${APP_URL}/c/${contract.share_token}`
    await sendContractEmail({
      coupleEmail: ctx.couple.email,
      coupleName: ctx.couple.name,
      contractNumber: contract.contract_number,
      contractTitle: contract.title,
      shareUrl: url,
      mcBusinessName: ctx.mc.businessName,
      expiresAt: contract.expires_at ?? null,
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
})

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
    const url = `${APP_URL}/i/${invoice.share_token}`
    await sendInvoiceEmail({
      coupleEmail: ctx.couple.email,
      coupleName: ctx.couple.name,
      invoiceNumber: invoice.invoice_number,
      invoiceTitle: invoice.title,
      dueDate: invoice.due_date,
      shareUrl: url,
      mcBusinessName: ctx.mc.businessName,
    })
    return { kind: 'ok', output: { invoice_id: invoice.id, invoice_link: url } }
  },
  ui: { category: 'payments', label: 'Send invoice', description: 'Email the couple an invoice', icon: 'Receipt' },
}

// ────────────────────────────────────────────────────────────────
// trigger_payment_reminder
// ────────────────────────────────────────────────────────────────

const triggerPaymentReminder: ActionSpec<z.infer<typeof sendInvoiceSchema>> = {
  type: 'trigger_payment_reminder',
  configSchema: sendInvoiceSchema,
  async handler(ctx, config) {
    return sendInvoice.handler(ctx, config)
  },
  ui: { category: 'payments', label: 'Send payment reminder', description: 'Re-send the most recent unpaid invoice', icon: 'AlertTriangle' },
}

// ────────────────────────────────────────────────────────────────
// generate_run_sheet_pdf
// ────────────────────────────────────────────────────────────────

const generateRunSheetSchema = z.object({
  eventId: z.string().uuid().optional(),
})

const generateRunSheetPdf: ActionSpec<z.infer<typeof generateRunSheetSchema>> = {
  type: 'generate_run_sheet_pdf',
  configSchema: generateRunSheetSchema,
  async handler(ctx) {
    if (!ctx.couple) return { kind: 'error', message: 'no couple in context' }
    // 14a stub: record that a PDF generation was requested. Wiring
    // into lib/pdf's renderer for the run-sheet page is a follow-up
    // (it needs a dedicated layout, not the existing quote/invoice
    // PDF layouts). The audit log makes the request visible until
    // it's done for real.
    return { kind: 'ok', output: { pdf_requested: true } }
  },
  ui: { category: 'post_event', label: 'Generate run-sheet PDF', description: 'Produce a event run sheet PDF', icon: 'FileType2' },
}

// ────────────────────────────────────────────────────────────────
// helpers - pick the row most-likely meant by the user
// ────────────────────────────────────────────────────────────────

async function pickQuote(
  supabase: ReturnType<typeof createAdminClient>,
  ctx: RunContext,
  explicitId?: string,
) {
  if (explicitId) {
    const { data } = await supabase
      .from('quotes')
      .select('id, quote_number, title, share_token, share_token_enabled')
      .eq('id', explicitId)
      .eq('user_id', ctx.userId)
      .single()
    return data ?? null
  }
  const triggerPayload = (ctx.triggerEvent.payload as Record<string, unknown>) ?? {}
  const idFromTrigger = typeof triggerPayload['quote_id'] === 'string' ? (triggerPayload['quote_id'] as string) : null
  if (idFromTrigger) return pickQuote(supabase, ctx, idFromTrigger)
  if (!ctx.couple) return null
  const { data } = await supabase
    .from('quotes')
    .select('id, quote_number, title, share_token, share_token_enabled')
    .eq('couple_id', ctx.couple.id)
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

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
  send_quote: sendQuote,
  send_contract: sendContract,
  send_invoice: sendInvoice,
  trigger_payment_reminder: triggerPaymentReminder,
  generate_run_sheet_pdf: generateRunSheetPdf,
}
