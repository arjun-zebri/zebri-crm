/**
 * Shared "apply a saved set of line items" source for the quote and
 * invoice builders.
 *
 * Surfaces both **quote templates** and **packages** as things you can
 * drop into a quote/invoice. Returns picker-ready options plus an
 * `applyMap` keyed by a namespaced id (`qt:<id>` / `pkg:<id>`) so the
 * builder can resolve a pick back to its line items + notes regardless
 * of source. Items are applied by copy (snapshot), never linked live.
 *
 * @module components/builders/parts/use-apply-sources
 */
'use client'

import { useQuery } from '@tanstack/react-query'

import { createClient } from '@/lib/supabase/client'

import type { QuoteTemplate } from './template-picker'

/** A single line item pulled from a source. */
export interface ApplyItem {
  description: string
  amount: number
}

export interface ApplySources {
  /** Picker-ready options (namespaced ids), templates first then packages. */
  options: QuoteTemplate[]
  /** Resolve a namespaced option id → its notes + line items. */
  applyMap: Record<string, { notes: string | null; items: ApplyItem[] }>
}

const EMPTY: ApplySources = { options: [], applyMap: {} }

/**
 * Load quote templates + packages as apply-sources for a builder.
 * Defensive: a missing/empty source contributes nothing, so the picker
 * simply shows fewer options rather than erroring.
 */
export function useApplySources() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['builder-apply-sources'],
    queryFn: async (): Promise<ApplySources> => {
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth.user?.id
      if (!uid) return EMPTY

      const [tpls, tplItems, pkgs, pkgItems] = await Promise.all([
        supabase.from('quote_templates').select('id, name, notes').eq('user_id', uid).order('position'),
        supabase.from('quote_template_items').select('template_id, description, amount, position').eq('user_id', uid).order('position'),
        supabase.from('packages').select('id, name, notes').eq('user_id', uid).order('position'),
        supabase.from('package_items').select('package_id, description, amount, position').eq('user_id', uid).order('position'),
      ])

      const byTpl: Record<string, ApplyItem[]> = {}
      for (const it of tplItems.data ?? []) (byTpl[it.template_id] ??= []).push({ description: it.description, amount: it.amount })
      const byPkg: Record<string, ApplyItem[]> = {}
      for (const it of pkgItems.data ?? []) (byPkg[it.package_id] ??= []).push({ description: it.description, amount: it.amount })

      const options: QuoteTemplate[] = []
      const applyMap: ApplySources['applyMap'] = {}

      for (const t of tpls.data ?? []) {
        const key = `qt:${t.id}`
        const items = byTpl[t.id] ?? []
        options.push({ id: key, name: t.name, notes: t.notes, itemCount: items.length })
        applyMap[key] = { notes: t.notes, items }
      }
      for (const p of pkgs.data ?? []) {
        const key = `pkg:${p.id}`
        const items = byPkg[p.id] ?? []
        options.push({ id: key, name: p.name, notes: p.notes, itemCount: items.length })
        applyMap[key] = { notes: p.notes, items }
      }

      return { options, applyMap }
    },
  })
}
