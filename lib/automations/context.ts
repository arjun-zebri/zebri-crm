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

import type { Database } from '@/types/database'
import type {
  AutomationEventRow,
  AutomationRunRow,
  CoupleSnapshot,
  McSnapshot,
  RunContext,
} from '@/types/automations'

const DEFAULT_TIMEZONE = 'Australia/Sydney'

/** Build a fresh context for the current action. */
export async function buildRunContext(
  supabase: SupabaseClient<Database>,
  run: AutomationRunRow,
  event: AutomationEventRow,
): Promise<RunContext> {
  const [couple, mc] = await Promise.all([
    run.couple_id ? loadCoupleSnapshot(supabase, run.couple_id) : Promise.resolve(null),
    loadMcSnapshot(supabase, run.user_id),
  ])
  const actionResults = (run.last_payload as Record<string, unknown> | null)?.['action_results']
  return {
    userId: run.user_id,
    automationId: run.automation_id,
    runId: run.id,
    coupleId: run.couple_id,
    triggerEvent: event,
    couple,
    mc,
    actionResults: (actionResults as Record<string, never>) ?? {},
  }
}

export async function loadCoupleSnapshot(
  supabase: SupabaseClient<Database>,
  coupleId: string,
): Promise<CoupleSnapshot | null> {
  const { data } = await supabase
    .from('couples')
    .select('id, user_id, name, email, phone, event_date, venue, notes, status')
    .eq('id', coupleId)
    .single()
  if (!data) return null

  const { primaryName, spouseName } = splitCoupleName(data.name)

  const spouseDetails = await loadSpouseDetails(supabase, coupleId)
  return {
    id: data.id,
    name: data.name,
    email: data.email || null,
    phone: data.phone || null,
    eventDate: data.event_date ?? null,
    venue: data.venue || null,
    status: data.status,
    primaryName,
    spouseName: spouseDetails.name ?? spouseName,
    spouseEmail: spouseDetails.email,
    spousePhone: spouseDetails.phone,
    timezone: DEFAULT_TIMEZONE,
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
    contactName: (metadata['display_name'] as string) ?? user?.email?.split('@')[0] ?? 'You',
    email: user?.email ?? '',
    phone: (metadata['phone'] as string) ?? null,
    brandColor: (metadata['brand_color'] as string) ?? null,
    logoUrl: (metadata['logo_url'] as string) ?? null,
    quietHoursStart: (metadata['quiet_hours_start'] as string) ?? '21:00',
    quietHoursEnd: (metadata['quiet_hours_end'] as string) ?? '08:00',
    quietHoursTimezone: (metadata['timezone'] as string) ?? (appMetadata['timezone'] as string) ?? DEFAULT_TIMEZONE,
  }
}
