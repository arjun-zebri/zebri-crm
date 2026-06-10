/**
 * Recipient resolver for automations.
 *
 * The "send to" picker on every messaging action exposes built-in
 * roles (`primary`, `spouse`, `family`, `vendor`, `custom`) plus
 * a fallback rule. This module turns a {@link RecipientSpec} into
 * concrete {@link ResolvedRecipient}s by reading the couple +
 * couple_contacts + contacts tables.
 *
 * Fallback handling is centralised here so every action behaves
 * the same way when a requested role can't be addressed (no spouse
 * email captured, no family contacts attached, etc.):
 *
 *   - `primary_only`  → drop the missing roles, send to the primary
 *                       couple email
 *   - `skip`          → return an empty list; the action handler
 *                       no-ops
 *   - `error`         → throw; the runner records the action as errored
 *
 * Celebrants frequently have a couple with one captured email
 * (the primary) and the spouse details still TBD. `primary_only`
 * is the sane default; the picker UI exposes the override.
 *
 * @module lib/automations/recipients
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'
import type {
  CoupleSnapshot,
  RecipientSpec,
  ResolvedRecipient,
} from '@/types/automations'

/**
 * Resolve a recipient spec for a couple. The supabase client must
 * be the service-role admin client (the runner is server-only).
 */
export async function resolveRecipients(
  supabase: SupabaseClient<Database>,
  couple: CoupleSnapshot,
  spec: RecipientSpec,
): Promise<ResolvedRecipient[]> {
  const resolved: ResolvedRecipient[] = []

  for (const role of spec.roles) {
    switch (role) {
      case 'primary':
        if (couple.email) {
          resolved.push({
            role,
            contactId: null,
            name: couple.primaryName || couple.name,
            email: couple.email,
            phone: couple.phone,
            fallbackApplied: false,
          })
        }
        break
      case 'spouse':
        if (couple.spouseEmail || couple.spousePhone) {
          resolved.push({
            role,
            contactId: null,
            name: couple.spouseName ?? 'Partner',
            email: couple.spouseEmail,
            phone: couple.spousePhone,
            fallbackApplied: false,
          })
        }
        break
      case 'family':
      case 'vendor':
      case 'custom': {
        const filtered = await loadCoupleContactsByRole(
          supabase,
          couple.id,
          role,
          role === 'custom' ? spec.customTag : undefined,
        )
        for (const f of filtered) resolved.push(f)
        break
      }
    }
  }

  if (resolved.length > 0) return resolved

  // No requested role resolved - apply fallback.
  switch (spec.fallback) {
    case 'primary_only':
      if (couple.email) {
        return [
          {
            role: 'primary',
            contactId: null,
            name: couple.primaryName || couple.name,
            email: couple.email,
            phone: couple.phone,
            fallbackApplied: true,
          },
        ]
      }
      return []
    case 'skip':
      return []
    case 'error':
      throw new RecipientResolutionError(
        `No recipients matched for spec roles=${spec.roles.join(',')}; couple has no primary email`,
      )
  }
}

/**
 * Read couple_contacts joined to contacts, filtering by role and
 * (when applicable) custom tag. The pattern matches the existing
 * couple-profile contact picker.
 */
async function loadCoupleContactsByRole(
  supabase: SupabaseClient<Database>,
  coupleId: string,
  role: 'family' | 'vendor' | 'custom',
  customTag?: string,
): Promise<ResolvedRecipient[]> {
  const { data, error } = await supabase
    .from('couple_contacts')
    .select('contact:contacts(id, name, contact_name, email, phone, category)')
    .eq('couple_id', coupleId)

  if (error || !data) return []

  const matches: ResolvedRecipient[] = []
  for (const row of data as unknown as Array<{ contact: ContactRow | null }>) {
    // contact may be null when the foreign key has dangled; skip.
    const c = row.contact
    if (!c) continue

    if (role === 'family' && !isFamilyContact(c)) continue
    if (role === 'vendor' && isFamilyContact(c)) continue
    if (role === 'custom') {
      const tag = customTag?.trim().toLowerCase()
      // V1 has no contacts.tags column - custom-tag matching falls
      // back to category matching while the tags column is added.
      if (!tag || (c.category ?? '').toLowerCase() !== tag) continue
    }

    matches.push({
      role,
      contactId: c.id,
      name: c.contact_name || c.name,
      email: c.email,
      phone: c.phone,
      fallbackApplied: false,
    })
  }
  return matches
}

interface ContactRow {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  category: string | null
}

function isFamilyContact(c: ContactRow): boolean {
  return (c.category ?? '').toLowerCase() === 'family'
}

export class RecipientResolutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecipientResolutionError'
  }
}
