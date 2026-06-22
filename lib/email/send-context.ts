/**
 * Build a {@link RunContext} for a manual (non-automation) email send.
 *
 * Mirrors what the automation runner assembles, but for an MC sending
 * by hand from a couple's profile: the couple snapshot (RLS-scoped),
 * an MC snapshot from the session user's metadata (no service role),
 * and the couple's current document links stamped onto the trigger
 * payload so `{{quote.link}}` / `{{invoice.link}}` / `{{contract.link}}`
 * / `{{portal.link}}` resolve the way they do in automations.
 *
 * Used by both the preview server action and the send route, so the
 * preview the MC sees is exactly what the authoritative send resolves.
 *
 * @module lib/email/send-context
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { loadCoupleSnapshot } from '@/lib/automations/context'
import type { EmailAttachment } from '@/lib/email'
import type { RunContext } from '@/types/automations'
import type { Database } from '@/types/database'

const ATTACHMENT_BUCKET = 'email-template-files'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.zebri.com.au'
const DEFAULT_TIMEZONE = 'Australia/Sydney'

/**
 * Download the chosen static attachments from storage (RLS via the
 * `email_template_files` metadata read + the owner-only bucket
 * policies). Unreadable files are skipped rather than failing the send.
 */
export async function downloadStaticAttachments(
  supabase: SupabaseClient<Database>,
  fileIds: string[],
): Promise<EmailAttachment[]> {
  if (fileIds.length === 0) return []
  const { data: rows } = await supabase
    .from('email_template_files')
    .select('file_name, storage_path')
    .in('id', fileIds)
  if (!rows?.length) return []

  const out: EmailAttachment[] = []
  for (const row of rows) {
    const { data: blob } = await supabase.storage.from(ATTACHMENT_BUCKET).download(row.storage_path)
    if (!blob) continue
    out.push({ filename: row.file_name, content: Buffer.from(await blob.arrayBuffer()) })
  }
  return out
}

/** Latest share-enabled link of a kind, or empty stamps. */
async function latestShareLink(
  supabase: SupabaseClient<Database>,
  table: 'quotes' | 'invoices' | 'contracts',
  coupleId: string,
  pathPrefix: string,
): Promise<{ link: string; number: string } | null> {
  const numberCol = table === 'contracts' ? 'contract_number' : `${table.slice(0, -1)}_number`
  const { data } = await supabase
    .from(table)
    .select(`share_token, ${numberCol}`)
    .eq('couple_id', coupleId)
    .eq('share_token_enabled', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const row = data as Record<string, string> | null
  if (!row?.share_token) return null
  return { link: `${APP_URL}/${pathPrefix}/${row.share_token}`, number: row[numberCol] ?? '' }
}

/**
 * Assemble the manual-send context for a couple, or `null` if the
 * couple can't be loaded (e.g. not owned by the caller — RLS).
 */
export async function buildManualSendContext(
  supabase: SupabaseClient<Database>,
  coupleId: string,
): Promise<RunContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const couple = await loadCoupleSnapshot(supabase, coupleId)
  if (!couple) return null

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>

  // Stamp the couple's current document + portal links so link
  // variables resolve. Each is best-effort — a missing one simply
  // stays unresolved and the missing-variable gate flags it.
  const [portalRow, quote, invoice, contract] = await Promise.all([
    supabase.from('couples').select('portal_token, portal_token_enabled').eq('id', coupleId).maybeSingle(),
    latestShareLink(supabase, 'quotes', coupleId, 'q'),
    latestShareLink(supabase, 'invoices', coupleId, 'i'),
    latestShareLink(supabase, 'contracts', coupleId, 'c'),
  ])

  const portal = portalRow.data as { portal_token?: string; portal_token_enabled?: boolean } | null
  const payload: Record<string, string> = {}
  if (portal?.portal_token && portal.portal_token_enabled) {
    payload['portal_link'] = `${APP_URL}/p/${portal.portal_token}`
  }
  if (quote) {
    payload['quote_link'] = quote.link
    payload['quote_number'] = quote.number
  }
  if (invoice) {
    payload['invoice_link'] = invoice.link
    payload['invoice_number'] = invoice.number
  }
  if (contract) {
    payload['contract_link'] = contract.link
    payload['contract_number'] = contract.number
  }

  return {
    userId: user.id,
    automationId: 'manual',
    runId: 'manual',
    coupleId,
    triggerEvent: {
      id: 'manual',
      user_id: user.id,
      source_table: 'couples',
      source_id: coupleId,
      event_type: 'new_enquiry' as never,
      payload: payload as never,
      couple_id: coupleId,
      created_at: new Date().toISOString(),
      processed_at: null,
      error_message: null,
    },
    couple,
    mc: {
      userId: user.id,
      businessName: (meta['business_name'] as string) ?? 'Your business',
      contactName: (meta['display_name'] as string) ?? user.email?.split('@')[0] ?? 'You',
      email: user.email ?? '',
      phone: (meta['phone'] as string) ?? null,
      brandColor: (meta['brand_color'] as string) ?? null,
      logoUrl: (meta['logo_url'] as string) ?? null,
      quietHoursStart: (meta['quiet_hours_start'] as string) ?? '21:00',
      quietHoursEnd: (meta['quiet_hours_end'] as string) ?? '08:00',
      quietHoursTimezone: (meta['timezone'] as string) ?? DEFAULT_TIMEZONE,
      signature: (meta['email_signature'] as RunContext['mc']['signature']) ?? null,
    },
    actionResults: {},
  }
}
