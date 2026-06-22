/**
 * Server actions for adding starter templates to the line-item template
 * surfaces (packages, quote templates, invoice templates) and contract
 * templates.
 *
 * These mirror `addStarterTemplatesAction` in `./actions.ts`: the client
 * sends only catalog **names**, content is resolved server-side from the
 * canonical catalogs, names the MC already owns are skipped (re-adding is
 * a no-op), new rows are appended after the current max position, and
 * every inserted row is flagged `is_starter` for provenance. All run
 * through the RLS-scoped server client (never the service role).
 *
 * @module app/(dashboard)/templates/starter-actions
 */
'use server'

import { z } from 'zod'

import { logger } from '@/lib/alerts/logger'
import { starterContractsByName } from '@/lib/contracts/starter-contracts'
import {
  STARTER_INVOICE_TEMPLATES,
  STARTER_PACKAGES,
  STARTER_QUOTE_TEMPLATES,
  startersByName,
  type StarterLineItemSet,
} from '@/lib/payments/starter-line-item-templates'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

/* ─── Tagged result type ───────────────────────────────────────── */

export interface ActionSuccess<T> {
  ok: true
  data: T
}
export interface ActionFailure {
  ok: false
  error: string
}
export type ActionResult<T> = ActionSuccess<T> | ActionFailure

/** Position gap between appended rows, matching the managers' reorder step. */
const POSITION_STEP = 1000

const namesSchema = z.array(z.string().trim().min(1)).min(1).max(50)

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

/* ─── Line-item starters (packages / quotes / invoices) ────────── */

/** The parent tables that hold a `name` + `position` + `is_starter`. */
type LineItemParentTable = 'packages' | 'quote_templates' | 'invoice_templates'

/**
 * Shared validation + resolution for the three line-item starter types:
 * authenticate, resolve catalog entries by name, drop names the MC
 * already owns, and compute the position to append after.
 */
async function resolveLineItemStarters(
  table: LineItemParentTable,
  catalog: readonly StarterLineItemSet[],
  names: string[],
): Promise<
  | { ok: false; error: string }
  | {
      ok: true
      supabase: Awaited<ReturnType<typeof createClient>>
      userId: string
      toInsert: StarterLineItemSet[]
      maxPosition: number
    }
> {
  const parsed = namesSchema.safeParse(names)
  if (!parsed.success) return { ok: false, error: 'Invalid request.' }

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const starters = startersByName(catalog, parsed.data)
  if (starters.length === 0) return { ok: true, supabase, userId: user.id, toInsert: [], maxPosition: 0 }

  const { data: existing } = await supabase.from(table).select('name, position').eq('user_id', user.id)
  const have = new Set((existing ?? []).map((r) => r.name))
  const maxPosition = (existing ?? []).reduce((m, r) => Math.max(m, r.position), 0)

  return { ok: true, supabase, userId: user.id, toInsert: starters.filter((s) => !have.has(s.name)), maxPosition }
}

/** Add starter packages (parent `packages` row + `package_items`). */
export async function addStarterPackagesAction(names: string[]): Promise<ActionResult<{ added: number }>> {
  const r = await resolveLineItemStarters('packages', STARTER_PACKAGES, names)
  if (!r.ok) return r
  const { supabase, userId, toInsert, maxPosition } = r

  for (let i = 0; i < toInsert.length; i++) {
    const set = toInsert[i]
    if (!set) continue
    const { data: parent, error } = await supabase
      .from('packages')
      .insert({ user_id: userId, name: set.name, notes: set.subtitle, is_starter: true, position: maxPosition + (i + 1) * POSITION_STEP })
      .select('id')
      .single()
    if (error || !parent) {
      logger.error('[templates/starter-actions] add packages failed', error, { userId })
      return { ok: false, error: 'Could not add packages.' }
    }
    if (set.items.length > 0) {
      const rows: Database['public']['Tables']['package_items']['Insert'][] = set.items.map((it, j) => ({
        package_id: parent.id,
        user_id: userId,
        description: it.description,
        amount: it.amount,
        position: (j + 1) * POSITION_STEP,
      }))
      const { error: itemsError } = await supabase.from('package_items').insert(rows)
      if (itemsError) {
        logger.error('[templates/starter-actions] add package_items failed', itemsError, { userId })
        return { ok: false, error: 'Could not add package items.' }
      }
    }
  }
  return { ok: true, data: { added: toInsert.length } }
}

/** Add starter quote templates (parent `quote_templates` + `quote_template_items`). */
export async function addStarterQuoteTemplatesAction(names: string[]): Promise<ActionResult<{ added: number }>> {
  const r = await resolveLineItemStarters('quote_templates', STARTER_QUOTE_TEMPLATES, names)
  if (!r.ok) return r
  const { supabase, userId, toInsert, maxPosition } = r

  for (let i = 0; i < toInsert.length; i++) {
    const set = toInsert[i]
    if (!set) continue
    const { data: parent, error } = await supabase
      .from('quote_templates')
      .insert({ user_id: userId, name: set.name, notes: set.subtitle, is_starter: true, position: maxPosition + (i + 1) * POSITION_STEP })
      .select('id')
      .single()
    if (error || !parent) {
      logger.error('[templates/starter-actions] add quote_templates failed', error, { userId })
      return { ok: false, error: 'Could not add quote templates.' }
    }
    if (set.items.length > 0) {
      const rows: Database['public']['Tables']['quote_template_items']['Insert'][] = set.items.map((it, j) => ({
        template_id: parent.id,
        user_id: userId,
        description: it.description,
        amount: it.amount,
        position: (j + 1) * POSITION_STEP,
      }))
      const { error: itemsError } = await supabase.from('quote_template_items').insert(rows)
      if (itemsError) {
        logger.error('[templates/starter-actions] add quote_template_items failed', itemsError, { userId })
        return { ok: false, error: 'Could not add quote template items.' }
      }
    }
  }
  return { ok: true, data: { added: toInsert.length } }
}

/** Add starter invoice templates (parent `invoice_templates` + `invoice_template_items`). */
export async function addStarterInvoiceTemplatesAction(names: string[]): Promise<ActionResult<{ added: number }>> {
  const r = await resolveLineItemStarters('invoice_templates', STARTER_INVOICE_TEMPLATES, names)
  if (!r.ok) return r
  const { supabase, userId, toInsert, maxPosition } = r

  for (let i = 0; i < toInsert.length; i++) {
    const set = toInsert[i]
    if (!set) continue
    const { data: parent, error } = await supabase
      .from('invoice_templates')
      .insert({ user_id: userId, name: set.name, notes: set.subtitle, is_starter: true, position: maxPosition + (i + 1) * POSITION_STEP })
      .select('id')
      .single()
    if (error || !parent) {
      logger.error('[templates/starter-actions] add invoice_templates failed', error, { userId })
      return { ok: false, error: 'Could not add invoice templates.' }
    }
    if (set.items.length > 0) {
      const rows: Database['public']['Tables']['invoice_template_items']['Insert'][] = set.items.map((it, j) => ({
        invoice_template_id: parent.id,
        user_id: userId,
        description: it.description,
        amount: it.amount,
        position: (j + 1) * POSITION_STEP,
      }))
      const { error: itemsError } = await supabase.from('invoice_template_items').insert(rows)
      if (itemsError) {
        logger.error('[templates/starter-actions] add invoice_template_items failed', itemsError, { userId })
        return { ok: false, error: 'Could not add invoice template items.' }
      }
    }
  }
  return { ok: true, data: { added: toInsert.length } }
}

/* ─── Contract starters ────────────────────────────────────────── */

/** Add starter contract templates (one `contract_templates` row each). */
export async function addStarterContractsAction(names: string[]): Promise<ActionResult<{ added: number }>> {
  const parsed = namesSchema.safeParse(names)
  if (!parsed.success) return { ok: false, error: 'Invalid request.' }

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const starters = starterContractsByName(parsed.data)
  if (starters.length === 0) return { ok: true, data: { added: 0 } }

  const { data: existing } = await supabase
    .from('contract_templates')
    .select('name, position')
    .eq('user_id', user.id)
  const have = new Set((existing ?? []).map((r) => r.name))
  const maxPosition = (existing ?? []).reduce((m, r) => Math.max(m, r.position), 0)

  const toInsert = starters.filter((c) => !have.has(c.name))
  if (toInsert.length === 0) return { ok: true, data: { added: 0 } }

  const rows: Database['public']['Tables']['contract_templates']['Insert'][] = toInsert.map((c, i) => ({
    user_id: user.id,
    name: c.name,
    description: c.description,
    // Cast via the Row (non-optional `Json`) type: Insert['content'] is
    // `Json | undefined`, which exactOptionalPropertyTypes rejects here.
    content: c.content as Database['public']['Tables']['contract_templates']['Row']['content'],
    is_starter: true,
    position: maxPosition + (i + 1) * POSITION_STEP,
  }))

  const { error } = await supabase.from('contract_templates').insert(rows)
  if (error) {
    logger.error('[templates/starter-actions] add contract_templates failed', error, { userId: user.id })
    return { ok: false, error: 'Could not add contract templates.' }
  }
  return { ok: true, data: { added: rows.length } }
}
