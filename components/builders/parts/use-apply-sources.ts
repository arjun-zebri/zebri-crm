/**
 * Shared "apply a saved set of line items" source for the invoice
 * builder.
 *
 * Surfaces **packages** (and opt-in invoice templates) as things you
 * can drop into an invoice. Returns picker-ready options plus an
 * `applyMap` keyed by a namespaced id (`it:<id>` / `pkg:<id>`) so the
 * builder can resolve a pick back to its content regardless of source.
 * Items are applied by copy (snapshot), never linked live.
 *
 * Applied notes come from each source's `description` column — the
 * customer-facing text — never from `notes`, which is the internal
 * subtitle shown only in the Templates list.
 *
 * Packages carry more than a flat item list (v2): optional add-ons the
 * MC ticks on apply, and pricing terms (deposit %, GST-inclusive flag,
 * weekend loading %) the builders use to pre-fill their controls.
 * Multi-unit items are flattened to "N × description" here because
 * quote/invoice line items carry no quantity.
 *
 * @module components/builders/parts/use-apply-sources
 */
'use client'

import { useQuery } from '@tanstack/react-query'

import { flattenItem } from '@/lib/payments/package-math'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/supabase/current-user'

import type { QuoteTemplate } from './template-picker'

/** A single line item pulled from a source. */
export interface ApplyItem {
  description: string
  amount: number
}

/** Package-level pricing terms that pre-fill builder controls on apply. */
export interface ApplyPackageMeta {
  id: string
  gstInclusive: boolean
  weekendLoadingPercent: number | null
  /** "Most popular" marketing flag, snapshotted into the option. */
  isPopular: boolean
}

/** Everything a builder needs to apply one picked source. */
export interface ApplySource {
  notes: string | null
  /** Base line items (flattened, ready for the items table). */
  items: ApplyItem[]
  /** Optional add-ons the MC picks from on apply (packages only). */
  addOns: ApplyItem[]
  /** Set when the source is a package; null for templates. */
  package: ApplyPackageMeta | null
}

export interface ApplySources {
  /** Picker-ready options (namespaced ids): invoice templates first
   *  (most specific when offered), then quote templates, then packages. */
  options: QuoteTemplate[]
  /** Resolve a namespaced option id → its content. */
  applyMap: Record<string, ApplySource>
}

interface UseApplySourcesOptions {
  /** Also offer invoice templates (`it:<id>`). Invoice builder only. */
  includeInvoiceTemplates?: boolean
}

const EMPTY: ApplySources = { options: [], applyMap: {} }

/**
 * Load templates + packages as apply-sources for a builder.
 * Defensive: a missing/empty source contributes nothing, so the picker
 * simply shows fewer options rather than erroring. `select('*')` (not
 * explicit v2 columns) keeps the package half working against a DB that
 * hasn't received the packages-v2 migration yet: missing fields read as
 * undefined and fall back below.
 */
export function useApplySources({
  includeInvoiceTemplates = false,
}: UseApplySourcesOptions = {}) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['builder-apply-sources', includeInvoiceTemplates],
    queryFn: async (): Promise<ApplySources> => {
      const uid = (await getCurrentUser())?.id
      if (!uid) return EMPTY

      const [pkgs, pkgItems, invTpls, invTplItems] = await Promise.all([
        supabase.from('packages').select('*').eq('user_id', uid).order('position'),
        supabase.from('package_items').select('*').eq('user_id', uid).order('position'),
        includeInvoiceTemplates
          ? supabase.from('invoice_templates').select('id, name, description').eq('user_id', uid).order('position')
          : Promise.resolve({ data: [] as { id: string; name: string; description: string | null }[] }),
        includeInvoiceTemplates
          ? supabase.from('invoice_template_items').select('invoice_template_id, description, amount, position').eq('user_id', uid).order('position')
          : Promise.resolve({ data: [] as { invoice_template_id: string; description: string; amount: number }[] }),
      ])

      const byInvTpl: Record<string, ApplyItem[]> = {}
      for (const it of invTplItems.data ?? []) (byInvTpl[it.invoice_template_id] ??= []).push({ description: it.description, amount: it.amount })

      const byPkg: Record<string, { base: ApplyItem[]; addOns: ApplyItem[] }> = {}
      for (const it of pkgItems.data ?? []) {
        const bucket = (byPkg[it.package_id] ??= { base: [], addOns: [] })
        ;(it.optional ? bucket.addOns : bucket.base).push(flattenItem(it))
      }

      const options: QuoteTemplate[] = []
      const applyMap: ApplySources['applyMap'] = {}

      for (const t of invTpls.data ?? []) {
        const key = `it:${t.id}`
        const items = byInvTpl[t.id] ?? []
        options.push({ id: key, name: t.name, notes: t.description, itemCount: items.length })
        applyMap[key] = { notes: t.description, items, addOns: [], package: null }
      }
      for (const p of pkgs.data ?? []) {
        // Archived packages keep their history but leave the pickers.
        if (p.archived_at) continue
        const key = `pkg:${p.id}`
        const bucket = byPkg[p.id] ?? { base: [], addOns: [] }
        // Only the package's customer-facing prose is applied; its
        // `notes` subtitle is internal to the Templates list.
        const notes = p.description ?? null
        options.push({
          id: key,
          name: p.name,
          notes,
          itemCount: bucket.base.length,
          addOnCount: bucket.addOns.length,
        })
        applyMap[key] = {
          notes,
          items: bucket.base,
          addOns: bucket.addOns,
          package: {
            id: p.id,
            gstInclusive: p.gst_inclusive ?? true,
            weekendLoadingPercent: p.weekend_loading_percent ?? null,
            isPopular: p.is_popular ?? false,
          },
        }
      }

      return { options, applyMap }
    },
  })
}
