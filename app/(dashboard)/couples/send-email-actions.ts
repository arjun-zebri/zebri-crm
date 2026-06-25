/**
 * Server action backing the couple "Send email" modal's live preview.
 *
 * Returns the resolved {@link RunContext} for a couple so the client
 * can render the template preview + run the missing-variable check
 * against the real couple's data. The authoritative send (and its
 * missing-variable gate) still happens server-side in
 * `/api/email/send-template` — this is preview only.
 *
 * @module app/(dashboard)/couples/send-email-actions
 */
'use server'

import { buildManualSendContext } from '@/lib/email/send-context'
import { createClient } from '@/lib/supabase/server'
import type { RunContext } from '@/types/automations'

export type SendContextResult = { ok: true; ctx: RunContext } | { ok: false; error: string }

/** Build the manual-send context for `coupleId` (RLS-scoped). */
export async function loadSendContextAction(coupleId: string): Promise<SendContextResult> {
  const supabase = await createClient()
  const ctx = await buildManualSendContext(supabase, coupleId)
  if (!ctx) return { ok: false, error: 'Could not load couple.' }
  return { ok: true, ctx }
}
