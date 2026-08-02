/**
 * Persistence layer for the Invoices template tab.
 *
 * Manages a named, ordered set of priced line items against
 * `invoice_templates` / `invoice_template_items`. This store owns every
 * read and write so the shared manager component stays free of table
 * plumbing. (It used to also serve a `quote` kind; quote templates were
 * retired, but the kind parameter stays so a future sibling table pair
 * can slot back in.)
 *
 * The Supabase client is injected (not created here) so integration
 * tests can exercise the exact production code paths with a signed-in
 * test user, proving RLS as the app sees it.
 *
 * @module app/(dashboard)/templates/template-store
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

/** Which template tab the store serves. */
export type TemplateKind = 'invoice'

/**
 * A template row as the managers consume it.
 *
 * Column semantics match packages: `notes` is the internal subtitle
 * shown in the template list; `description` is the customer-facing text
 * appended to the invoice notes when the template is applied.
 */
export interface TemplateRecord {
  id: string
  name: string
  notes: string | null
  description: string | null
  position: number
  updated_at: string
}

/** A persisted line item (id is stable until the next item rewrite). */
export interface StoredItem {
  id: string
  description: string
  amount: number
}

/** Everything a save writes: template fields plus items in final order. */
export interface TemplateDraft {
  name: string
  notes: string | null
  description: string | null
  items: { description: string; amount: number }[]
}

type Client = SupabaseClient<Database>

/** Bulk-insert a draft's items in array order (uniform keys per row). */
async function insertItems(
  client: Client,
  uid: string,
  templateId: string,
  items: TemplateDraft['items'],
): Promise<void> {
  if (items.length === 0) return
  const { error } = await client.from('invoice_template_items').insert(
    items.map((item, i) => ({
      invoice_template_id: templateId,
      user_id: uid,
      description: item.description,
      amount: item.amount,
      position: (i + 1) * 1000,
    })),
  )
  if (error) throw error
}

/**
 * Create a typed CRUD store for one template kind.
 *
 * All reads and writes are owner-scoped (`user_id = uid`) on top of the
 * tables' RLS, matching the rest of the templates page.
 */
// The kind parameter is accepted (and currently unused) so callers keep
// one construction site if a sibling table pair ever returns.
export function createTemplateStore(client: Client, kind: TemplateKind = 'invoice') {
  void kind
  const fields = 'id, name, notes, description, position, updated_at'

  return {
    /** Templates in list order. */
    async list(uid: string): Promise<TemplateRecord[]> {
      const { data, error } = await client
        .from('invoice_templates')
        .select(fields)
        .eq('user_id', uid)
        .order('position', { ascending: true })
      if (error) throw error
      return data ?? []
    },

    /** All items grouped by template id, each group in item order. */
    async listItems(uid: string): Promise<Record<string, StoredItem[]>> {
      const grouped: Record<string, StoredItem[]> = {}
      const { data, error } = await client
        .from('invoice_template_items')
        .select('id, invoice_template_id, description, amount')
        .eq('user_id', uid)
        .order('position', { ascending: true })
      if (error) throw error
      for (const item of data ?? []) {
        ;(grouped[item.invoice_template_id] ??= []).push({
          id: item.id,
          description: item.description,
          amount: item.amount,
        })
      }
      return grouped
    },

    /** Insert a template at `position` with its items; returns the new id. */
    async create(uid: string, draft: TemplateDraft, position: number): Promise<string> {
      const row = {
        user_id: uid,
        name: draft.name,
        notes: draft.notes,
        description: draft.description,
        position,
      }
      const { data, error } = await client.from('invoice_templates').insert(row).select('id').single()
      if (error) throw error
      await insertItems(client, uid, data.id, draft.items)
      return data.id
    },

    /**
     * Update a template's fields and rewrite its items.
     *
     * Items are wiped and reinserted in the draft's array order — the
     * form's ordering is the source of truth, which is what persists a
     * drag-reorder (previously lost: only description/amount were
     * updated). Safe because nothing references template items
     * (builders snapshot by copy), so regenerated ids are harmless.
     * Same pattern as the packages manager.
     *
     * `updated_at` is set explicitly: these tables have no touch
     * trigger, so without it "Edited X ago" would show creation time
     * forever.
     */
    async update(uid: string, id: string, draft: TemplateDraft): Promise<void> {
      const patch = {
        name: draft.name,
        notes: draft.notes,
        description: draft.description,
        updated_at: new Date().toISOString(),
      }
      const { error } = await client.from('invoice_templates').update(patch).eq('id', id).eq('user_id', uid)
      if (error) throw error
      const { error: wipeError } = await client
        .from('invoice_template_items')
        .delete()
        .eq('invoice_template_id', id)
        .eq('user_id', uid)
      if (wipeError) throw wipeError
      await insertItems(client, uid, id, draft.items)
    },

    /** Delete a template; its items cascade at the DB level. */
    async remove(uid: string, id: string): Promise<void> {
      const { error } = await client.from('invoice_templates').delete().eq('id', id).eq('user_id', uid)
      if (error) throw error
    },

    /** Persist a full list order (spaced positions, matching create). */
    async setPositions(uid: string, orderedIds: string[]): Promise<void> {
      for (let i = 0; i < orderedIds.length; i++) {
        const id = orderedIds[i]
        if (!id) continue
        const { error } = await client
          .from('invoice_templates')
          .update({ position: (i + 1) * 1000 })
          .eq('id', id)
          .eq('user_id', uid)
        if (error) throw error
      }
    },
  }
}

/** The store instance type consumed by the shared manager. */
export type TemplateStore = ReturnType<typeof createTemplateStore>
