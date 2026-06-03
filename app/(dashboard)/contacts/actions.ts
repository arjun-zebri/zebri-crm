/**
 * Server actions for the Contacts surface (Phase 5).
 *
 * Lifts inline `supabase.from('contacts')…` writes out of
 * `use-contacts.ts` so the hook is a thin React Query wrapper
 * around server-validated mutations. Every action:
 *
 * - **Zod-validates** the input. Category enum is the canonical
 *   set from `@/types/contact` so the action rejects junk values
 *   instead of corrupting downstream filters.
 * - **RLS-scoped** Supabase client. We never escape to the
 *   service role here.
 * - Returns a tagged `{ ok, data } | { ok: false, error }` result
 *   the hook can pattern-match.
 *
 * Note: `updateContactAction` and `deleteContactAction` already
 * existed on `couples/portal-actions.ts` for the MC-portal-contacts
 * surface. Those stay where they are (different consumer); this
 * module provides the same operations scoped to the standalone
 * `/contacts` page + adds create/bulk variants. The DB write is
 * identical; the difference is which hook owns the cache
 * invalidation.
 *
 * @module app/(dashboard)/contacts/actions
 */
'use server';

import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { createClient } from '@/lib/supabase/server';
import { CATEGORIES, type Contact } from '@/types/contact';

/* ─── Tagged result type ───────────────────────────────────────── */

export interface ActionSuccess<T> {
  ok: true;
  data: T;
}

export interface ActionFailure {
  ok: false;
  error: string;
}

export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

/* ─── Shared shapes ────────────────────────────────────────────── */

const uuidSchema = z.uuid();

// Category enum is closed — only the canonical set is acceptable.
// `as [string, ...string[]]` keeps Zod happy; CATEGORIES is non-empty.
const categorySchema = z.enum(CATEGORIES as unknown as [string, ...string[]]);

const statusSchema = z.enum(['active', 'inactive']);

const contactInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  contact_name: z.string().trim().max(200).default(''),
  email: z.string().trim().max(200).default(''),
  phone: z.string().trim().max(50).default(''),
  category: categorySchema,
  notes: z.string().max(5000).default(''),
  status: statusSchema.default('active'),
});

export type ContactInput = z.input<typeof contactInputSchema>;

/* ─── createContactAction ─────────────────────────────────────── */

export async function createContactAction(
  input: ContactInput,
): Promise<ActionResult<Contact>> {
  const parsed = contactInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid contact data.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('contacts')
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error || !data) {
    logger.error('[contacts/actions] createContactAction failed', error, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not create contact.' };
  }

  return { ok: true, data: data as Contact };
}

/* ─── updateContactAction ─────────────────────────────────────── */

const updateContactSchema = contactInputSchema.extend({
  id: uuidSchema,
});

export type UpdateContactInput = z.input<typeof updateContactSchema>;

export async function updateContactAction(
  input: UpdateContactInput,
): Promise<ActionResult<Contact>> {
  const parsed = updateContactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid contact data.' };
  }
  const { id, ...rest } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('contacts')
    .update(rest)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    logger.error('[contacts/actions] updateContactAction failed', error, {
      userId: user.id,
      contactId: id,
    });
    return { ok: false, error: 'Could not update contact.' };
  }

  return { ok: true, data: data as Contact };
}

/* ─── deleteContactAction ─────────────────────────────────────── */

export async function deleteContactAction(
  contactId: string,
): Promise<ActionResult<void>> {
  const parsed = uuidSchema.safeParse(contactId);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid contact ID.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', parsed.data);

  if (error) {
    logger.error('[contacts/actions] deleteContactAction failed', error, {
      userId: user.id,
      contactId,
    });
    return { ok: false, error: 'Could not delete contact.' };
  }

  return { ok: true, data: undefined };
}

/* ─── bulkDeleteContactsAction ────────────────────────────────── */

const bulkDeleteSchema = z.array(uuidSchema).min(1, 'No contacts selected');

export async function bulkDeleteContactsAction(
  ids: string[],
): Promise<ActionResult<void>> {
  const parsed = bulkDeleteSchema.safeParse(ids);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid bulk-delete payload.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('contacts')
    .delete()
    .in('id', parsed.data);

  if (error) {
    logger.error('[contacts/actions] bulkDeleteContactsAction failed', error, {
      userId: user.id,
      count: parsed.data.length,
    });
    return { ok: false, error: 'Could not delete contacts.' };
  }

  return { ok: true, data: undefined };
}

/* ─── bulkUpdateContactsStatusAction ──────────────────────────── */

const bulkUpdateStatusSchema = z.object({
  ids: z.array(uuidSchema).min(1, 'No contacts selected'),
  status: statusSchema,
});

export type BulkUpdateContactsStatusInput = z.input<
  typeof bulkUpdateStatusSchema
>;

export async function bulkUpdateContactsStatusAction(
  input: BulkUpdateContactsStatusInput,
): Promise<ActionResult<void>> {
  const parsed = bulkUpdateStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid bulk-status payload.' };
  }
  const { ids, status } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('contacts')
    .update({ status })
    .in('id', ids);

  if (error) {
    logger.error(
      '[contacts/actions] bulkUpdateContactsStatusAction failed',
      error,
      { userId: user.id, count: ids.length },
    );
    return { ok: false, error: 'Could not update contacts.' };
  }

  return { ok: true, data: undefined };
}
