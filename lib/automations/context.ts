/**
 * Build {@link RunContext} from a triggering event.
 *
 * The runner calls this once per action iteration so each handler
 * sees the latest couple / MC / action-result snapshot. We re-read
 * the couple row on every iteration so a wait → email sequence
 * picks up any field changes made by earlier actions.
 *
 * @module lib/automations/context
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { buildPublicBranding, type UserMetadata } from '@/lib/branding/public-branding'
import { resolveCoupleEmail } from '@/lib/couples/email'
import type {
  AutomationEventRow,
  AutomationRunRow,
  CoupleSnapshot,
  InvoiceSnapshot,
  McSnapshot,
  RunContext,
} from '@/types/automations'
import type { Database } from '@/types/database'

const DEFAULT_TIMEZONE = 'Australia/Sydney'

/** Build a fresh context for the current action. */
export async function buildRunContext(
  supabase: SupabaseClient<Database>,
  run: AutomationRunRow,
  event: AutomationEventRow,
): Promise<RunContext> {
  const [couple, mc, invoice, contractSignedAt] = await Promise.all([
    run.couple_id ? loadCoupleSnapshot(supabase, run.couple_id) : Promise.resolve(null),
    loadMcSnapshot(supabase, run.user_id),
    run.couple_id ? loadInvoiceSnapshot(supabase, run.couple_id, event) : Promise.resolve(null),
    run.couple_id ? loadContractSignedAt(supabase, run.couple_id) : Promise.resolve(null),
  ])
  const actionResults = (run.last_payload as Record<string, unknown> | null)?.['action_results']
  return {
    userId: run.user_id,
    automationId: run.automation_id,
    runId: run.id,
    coupleId: run.couple_id,
    triggerEvent: event,
    couple,
    invoice,
    contractSignedAt,
    mc,
    actionResults: (actionResults as Record<string, never>) ?? {},
  }
}

/**
 * When the couple last signed a contract, or null.
 *
 * One field rather than a snapshot: the only thing that reads it is
 * the `has_signed_contract` branch condition, and "have they signed?"
 * is the whole question. Signing is monotonic, so the most recent
 * signature is the answer for every contract they hold.
 */
export async function loadContractSignedAt(
  supabase: SupabaseClient<Database>,
  coupleId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('contracts')
    .select('signed_at')
    .eq('couple_id', coupleId)
    .not('signed_at', 'is', null)
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.signed_at as string | null) ?? null
}

export async function loadCoupleSnapshot(
  supabase: SupabaseClient<Database>,
  coupleId: string,
): Promise<CoupleSnapshot | null> {
  const { data } = await supabase
    .from('couples')
    .select(
      'id, user_id, name, email, phone, event_date, venue, notes, status, lead_source, primary_name, primary_email, primary_phone, secondary_name, secondary_email, secondary_phone, portal_token, secondary_portal_token, portal_token_enabled',
    )
    .eq('id', coupleId)
    .single()
  if (!data) return null

  const { primaryName, spouseName } = splitCoupleName(data.name)

  const [spouseDetails, primaryEvent] = await Promise.all([
    loadSpouseDetails(supabase, coupleId),
    loadPrimaryEvent(supabase, coupleId),
  ])
  // Post partner-triples migration, new couples carry only the
  // `primary_*` / `secondary_*` columns — the legacy couple-level
  // email/phone stay empty. Prefer the partner columns, fall back
  // to legacy values (pre-migration rows) and name-split heuristics.
  // Portal-submitted partner details still win for the spouse: the
  // couple typed those in themselves.
  return {
    id: data.id,
    name: data.name,
    email: resolveCoupleEmail(data),
    phone: data.primary_phone?.trim() || data.phone || null,
    // Event date/venue live on the couple's events (managed via the
    // Events tab) — the legacy couple-level columns aren't captured for
    // new couples. Prefer the couple's earliest event (matching the
    // contract/quote senders), fall back to the legacy columns for
    // pre-events-table couples. Without this, `{{event.date}}` /
    // `{{venue.name}}` resolve empty on every manual send + automation.
    eventDate: primaryEvent?.date ?? data.event_date ?? null,
    venue: primaryEvent?.venue || data.venue || null,
    status: data.status,
    leadSource: data.lead_source ?? null,
    primaryName: data.primary_name?.trim() || primaryName,
    spouseName: spouseDetails.name ?? data.secondary_name ?? spouseName,
    spouseEmail: spouseDetails.email ?? data.secondary_email,
    spousePhone: spouseDetails.phone ?? data.secondary_phone,
    timezone: DEFAULT_TIMEZONE,
    portalToken: data.portal_token ?? null,
    secondaryPortalToken: (data as { secondary_portal_token?: string | null }).secondary_portal_token ?? null,
    portalEnabled: data.portal_token_enabled ?? false,
    runSheetToken: primaryEvent?.shareToken ?? null,
    runSheetEnabled: primaryEvent?.shareEnabled ?? false,
  }
}

/**
 * The couple's representative event (date + venue) for variable
 * resolution: the earliest event row, matching how the contract / quote
 * senders pick `firstEvent`. Returns null when the couple has no events
 * yet, so the caller falls back to the legacy couple-level columns.
 */
async function loadPrimaryEvent(
  supabase: SupabaseClient<Database>,
  coupleId: string,
): Promise<{
  date: string | null
  venue: string | null
  shareToken: string | null
  shareEnabled: boolean
} | null> {
  const { data } = await supabase
    .from('events')
    .select('date, venue, share_token, share_token_enabled')
    .eq('couple_id', coupleId)
    .order('date', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return {
    date: data.date,
    venue: data.venue,
    shareToken: data.share_token ?? null,
    shareEnabled: data.share_token_enabled ?? false,
  }
}

/**
 * Read the couple's spouse details from portal_people. The portal
 * lets the couple submit partner info under category='partner' -
 * we use that as the canonical spouse contact when present.
 */
async function loadSpouseDetails(
  supabase: SupabaseClient<Database>,
  coupleId: string,
): Promise<{ name: string | null; email: string | null; phone: string | null }> {
  const { data } = await supabase
    .from('portal_people' as never)
    .select('full_name, email, phone')
    .eq('couple_id', coupleId)
    .eq('category', 'partner')
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()
  const row = data as { full_name?: string; email?: string; phone?: string } | null
  return {
    name: row?.full_name ?? null,
    email: row?.email ?? null,
    phone: row?.phone ?? null,
  }
}

/**
 * Load an invoice snapshot for a couple.
 *
 * Invoice resolution follows this rule:
 * 1. If triggerEvent.payload.invoice_id is present, use that invoice. The
 *    invoice-related triggers carry it, and it is the specific invoice the
 *    run is about. Being specific matters for a reminder chain on one invoice
 *    while another sits unpaid.
 * 2. Otherwise, use the couple's most recent non-cancelled invoice. An MC
 *    who puts "has paid deposit" on a time-before-event automation means
 *    "has this couple paid their deposit yet", and returning null because
 *    the trigger was not invoice-shaped would just be the current bug with
 *    a smaller blast radius.
 * 3. If neither resolves, return null and the condition is false.
 *
 * The snapshot carries the paid_at timestamp of the invoice's first
 * (lowest position) payment stage, or null if unpaid.
 */
export async function loadInvoiceSnapshot(
  supabase: SupabaseClient<Database>,
  coupleId: string,
  event: AutomationEventRow,
): Promise<InvoiceSnapshot | null> {
  const invoiceIdFromPayload = (event.payload as Record<string, unknown> | null)?.['invoice_id']
  const invoiceId = typeof invoiceIdFromPayload === 'string' ? invoiceIdFromPayload : null

  let invoice: { id: string; status?: string } | null = null

  if (invoiceId) {
    const { data } = await supabase
      .from('invoices')
      .select('id, status')
      .eq('id', invoiceId)
      .eq('couple_id', coupleId)
      .single()
    invoice = data
  } else {
    const { data } = await supabase
      .from('invoices')
      .select('id, status')
      .eq('couple_id', coupleId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    invoice = data
  }

  if (!invoice) return null

  const { data: stages } = await supabase
    .from('invoice_payment_stages')
    .select('position, paid_at')
    .eq('invoice_id', invoice.id)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()

  return {
    id: invoice.id,
    firstStagePaidAt: (stages?.['paid_at'] as string | null) ?? null,
    ...(invoice.status ? { status: invoice.status } : {}),
  }
}

/**
 * Split a "Sam & Alex" / "Sam and Alex" couple display name into
 * (primary, spouse). When the name doesn't split cleanly, the
 * whole name is the primary and spouse is null - the user can fix
 * by capturing the partner via the portal.
 */
export function splitCoupleName(name: string): { primaryName: string; spouseName: string | null } {
  const separators = [' & ', ' and ', ' + ', ' / ']
  for (const sep of separators) {
    const idx = name.indexOf(sep)
    if (idx > 0) {
      return {
        primaryName: name.slice(0, idx).trim(),
        spouseName: name.slice(idx + sep.length).trim() || null,
      }
    }
  }
  return { primaryName: name, spouseName: null }
}

export async function loadMcSnapshot(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<McSnapshot> {
  const { data: userRow } = await supabase.auth.admin.getUserById(userId)
  const user = userRow?.user
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>
  const appMetadata = (user?.app_metadata ?? {}) as Record<string, unknown>
  return {
    userId,
    businessName: (metadata['business_name'] as string) ?? 'Your business',
    reviewLink: (metadata['google_review_url'] as string) ?? null,
    contactName: (metadata['display_name'] as string) ?? user?.email?.split('@')[0] ?? 'You',
    email: user?.email ?? '',
    phone: (metadata['phone'] as string) ?? null,
    brandColor: (metadata['brand_color'] as string) ?? null,
    logoUrl: (metadata['logo_url'] as string) ?? null,
    quietHoursStart: (metadata['quiet_hours_start'] as string) ?? '21:00',
    quietHoursEnd: (metadata['quiet_hours_end'] as string) ?? '08:00',
    quietHoursTimezone: (metadata['timezone'] as string) ?? (appMetadata['timezone'] as string) ?? DEFAULT_TIMEZONE,
    signature: (metadata['email_signature'] as McSnapshot['signature']) ?? null,
    // Resolved branding for the branded email shell — automation sends
    // look identical to manual sends and the editor preview.
    branding: buildPublicBranding(metadata as UserMetadata),
  }
}
