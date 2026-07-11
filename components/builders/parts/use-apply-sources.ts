/**
 * Shared "apply a saved set of line items" source for the quote and
 * invoice builders.
 *
 * Surfaces **packages** (and opt-in invoice templates / accepted
 * proposals) as things you can drop
 * into a quote or invoice, plus **invoice templates** when the caller
 * opts in (the invoice builder does; a quote never starts from an
 * invoice template). Returns picker-ready options plus an `applyMap`
 * keyed by a namespaced id (`it:<id>` / `pkg:<id>` / `prop:<id>`) so the
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

import type { QuoteTemplate } from './template-picker'

/** A single line item pulled from a source. */
export interface ApplyItem {
  description: string
  amount: number
}

/** Package-level pricing terms that pre-fill builder controls on apply. */
export interface ApplyPackageMeta {
  id: string
  depositPercent: number | null
  gstInclusive: boolean
  weekendLoadingPercent: number | null
  /** "Most popular" marketing flag, snapshotted into the option. */
  isPopular: boolean
}

/** Accepted-proposal terms that pre-fill the invoice on apply. */
export interface ApplyProposalMeta {
  id: string
  /** The accepted option's snapshotted terms. */
  depositPercent: number | null
  gstInclusive: boolean
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
  /** Set when the source is an accepted proposal: the items are the
   *  RECORDED selection (base + ticked add-ons) and the meta carries
   *  the accepted option's deposit/GST terms. */
  proposal?: ApplyProposalMeta | null
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
  /** Also offer ACCEPTED proposals (`prop:<id>`) — the recorded
   *  selection becomes the invoice, terms and all. Invoice builder
   *  only. */
  includeAcceptedProposals?: boolean
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
  includeAcceptedProposals = false,
}: UseApplySourcesOptions = {}) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['builder-apply-sources', includeInvoiceTemplates, includeAcceptedProposals],
    queryFn: async (): Promise<ApplySources> => {
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth.user?.id
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

      // Accepted proposals FIRST — "invoice what the couple agreed to"
      // is the most specific starting point the invoice builder has.
      if (includeAcceptedProposals) {
        const { data: proposals } = await supabase
          .from('proposals')
          .select(
            'id, proposal_number, title, notes, accepted_option_id, accepted_addon_selection, proposal_options!proposals_accepted_option_id_fkey(id, title, deposit_percent, gst_inclusive)',
          )
          .eq('user_id', uid)
          .eq('status', 'accepted')
          .order('accepted_at', { ascending: false })
        for (const p of proposals ?? []) {
          const option = Array.isArray(p.proposal_options)
            ? p.proposal_options[0]
            : p.proposal_options
          if (!option || !p.accepted_option_id) continue
          const { data: optionItems } = await supabase
            .from('proposal_option_items')
            .select('id, description, amount, is_addon, position')
            .eq('option_id', p.accepted_option_id)
            .order('position')
          const selection = (p.accepted_addon_selection ?? {}) as Record<string, boolean>
          // The recorded agreement: base items + TICKED add-ons only.
          const items = (optionItems ?? [])
            .filter((item) => !item.is_addon || selection[item.id])
            .map((item) => ({ description: item.description, amount: Number(item.amount) }))
          const key = `prop:${p.id}`
          options.push({
            id: key,
            name: `${p.proposal_number} — ${option.title} (accepted)`,
            notes: p.notes,
            itemCount: items.length,
          })
          applyMap[key] = {
            notes: p.notes,
            items,
            addOns: [],
            package: null,
            proposal: {
              id: p.id,
              depositPercent: option.deposit_percent != null ? Number(option.deposit_percent) : null,
              gstInclusive: option.gst_inclusive,
            },
          }
        }
      }

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
            depositPercent: p.deposit_percent ?? null,
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
