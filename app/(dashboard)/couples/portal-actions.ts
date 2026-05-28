/**
 * Server actions for the MC Portal sections inside the Couple
 * Profile (Phase 4D).
 *
 * Each action validates input with Zod, runs against an RLS-scoped
 * Supabase client, and returns a tagged `ActionResult<T>`.
 *
 * **Storage uploads** stay client-side: the file blob never round-
 * trips through the server, but every DB-row insert that references
 * the upload (e.g. `portal_files.file_url`) is gated by the action
 * below. Same trust boundary as today.
 *
 * Three groups:
 *
 * 1. **Portal people / songs / song-categories / files** — the
 *    couple-facing portal content the MC manages.
 * 2. **Couple contacts + raw contacts** — vendors attached to a
 *    couple (the Contacts tab inside the profile). `couple_contacts`
 *    is the join; `contacts` is the addressbook entity.
 * 3. **Timeline review** — `approveTimelineItemAction` flips
 *    `pending_review` to false on a single item (the "approve from
 *    portal review" surface on use-portal-data).
 *
 * @module app/(dashboard)/couples/portal-actions
 */
'use server';

import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { createClient } from '@/lib/supabase/server';

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

/* ─── Portal people ───────────────────────────────────────────── */

const addPersonSchema = z.object({
  couple_id: uuidSchema,
  // User-customisable — the original CHECK constraint allowed only
  // 'partner', 'bridal_party', 'family' but later migrations relaxed
  // it. Don't enum here; the trim+min+max keeps junk out.
  category: z.string().trim().min(1).max(100),
  full_name: z.string().trim().min(1, 'Name is required').max(200),
  phonetic: z.string().trim().max(500).nullable().default(null),
  role: z.string().trim().max(200).nullable().default(null),
  audio_url: z.string().trim().max(2000).nullable().default(null),
  notes: z.string().max(5000).nullable().default(null),
  position: z.number().int().default(0),
});

export type AddPortalPersonInput = z.input<typeof addPersonSchema>;

export async function addPortalPersonAction(
  input: AddPortalPersonInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = addPersonSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid person data.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('portal_people')
    .insert({ ...parsed.data, user_id: user.id })
    .select('id')
    .single();

  if (error || !data) {
    logger.error('[portal-actions] addPortalPersonAction failed', error, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not add person.' };
  }

  return { ok: true, data: { id: data.id } };
}

const updatePersonSchema = z.object({
  id: uuidSchema,
  patch: z
    .object({
      full_name: z.string().trim().min(1).max(200).optional(),
      phonetic: z.string().trim().max(500).nullable().optional(),
      role: z.string().trim().max(200).nullable().optional(),
      audio_url: z.string().trim().max(2000).nullable().optional(),
      notes: z.string().max(5000).nullable().optional(),
      position: z.number().int().optional(),
    })
    .refine((p) => Object.keys(p).length > 0, {
      message: 'Patch must contain at least one field',
    }),
});

export type UpdatePortalPersonInput = z.input<typeof updatePersonSchema>;

export async function updatePortalPersonAction(
  input: UpdatePortalPersonInput,
): Promise<ActionResult<void>> {
  const parsed = updatePersonSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid person patch.' };
  }
  const { id, patch } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const compact = compactPatch(patch);
  const { error } = await supabase
    .from('portal_people')
    .update(compact)
    .eq('id', id);

  if (error) {
    logger.error('[portal-actions] updatePortalPersonAction failed', error, {
      userId: user.id,
      personId: id,
    });
    return { ok: false, error: 'Could not update person.' };
  }

  return { ok: true, data: undefined };
}

export async function deletePortalPersonAction(
  id: string,
): Promise<ActionResult<void>> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: 'Invalid person ID.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('portal_people')
    .delete()
    .eq('id', parsed.data);

  if (error) {
    logger.error('[portal-actions] deletePortalPersonAction failed', error, {
      userId: user.id,
      personId: id,
    });
    return { ok: false, error: 'Could not remove person.' };
  }

  return { ok: true, data: undefined };
}

/* ─── Portal songs ────────────────────────────────────────────── */

const addSongSchema = z.object({
  couple_id: uuidSchema,
  category: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1, 'Title is required').max(500),
  artist: z.string().trim().max(500).nullable().default(null),
  notes: z.string().max(5000).nullable().default(null),
  position: z.number().int().default(0),
});

export type AddPortalSongInput = z.input<typeof addSongSchema>;

export async function addPortalSongAction(
  input: AddPortalSongInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = addSongSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid song data.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('portal_songs')
    .insert({ ...parsed.data, user_id: user.id })
    .select('id')
    .single();

  if (error || !data) {
    logger.error('[portal-actions] addPortalSongAction failed', error, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not add song.' };
  }

  return { ok: true, data: { id: data.id } };
}

const updateSongSchema = z.object({
  id: uuidSchema,
  patch: z
    .object({
      title: z.string().trim().min(1).max(500).optional(),
      artist: z.string().trim().max(500).nullable().optional(),
      notes: z.string().max(5000).nullable().optional(),
      position: z.number().int().optional(),
    })
    .refine((p) => Object.keys(p).length > 0, {
      message: 'Patch must contain at least one field',
    }),
});

export type UpdatePortalSongInput = z.input<typeof updateSongSchema>;

export async function updatePortalSongAction(
  input: UpdatePortalSongInput,
): Promise<ActionResult<void>> {
  const parsed = updateSongSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid song patch.' };
  const { id, patch } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const compact = compactPatch(patch);
  const { error } = await supabase
    .from('portal_songs')
    .update(compact)
    .eq('id', id);

  if (error) {
    logger.error('[portal-actions] updatePortalSongAction failed', error, {
      userId: user.id,
      songId: id,
    });
    return { ok: false, error: 'Could not update song.' };
  }

  return { ok: true, data: undefined };
}

export async function deletePortalSongAction(
  id: string,
): Promise<ActionResult<void>> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: 'Invalid song ID.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('portal_songs')
    .delete()
    .eq('id', parsed.data);

  if (error) {
    logger.error('[portal-actions] deletePortalSongAction failed', error, {
      userId: user.id,
      songId: id,
    });
    return { ok: false, error: 'Could not remove song.' };
  }

  return { ok: true, data: undefined };
}

/* ─── Portal song categories ──────────────────────────────────── */

const addSongCategorySchema = z.object({
  couple_id: uuidSchema,
  key: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(200),
  description: z.string().max(1000).nullable().default(null),
  position: z.number().int().default(0),
});

export type AddPortalSongCategoryInput = z.input<typeof addSongCategorySchema>;

export async function addPortalSongCategoryAction(
  input: AddPortalSongCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = addSongCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid category data.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('portal_song_categories')
    .insert({ ...parsed.data, user_id: user.id })
    .select('id')
    .single();

  if (error || !data) {
    logger.error(
      '[portal-actions] addPortalSongCategoryAction failed',
      error,
      { userId: user.id },
    );
    return { ok: false, error: 'Could not add category.' };
  }

  return { ok: true, data: { id: data.id } };
}

export async function updatePortalSongCategoryAction(
  id: string,
  label: string,
): Promise<ActionResult<void>> {
  const idParsed = uuidSchema.safeParse(id);
  const labelParsed = z.string().trim().min(1).max(200).safeParse(label);
  if (!idParsed.success || !labelParsed.success) {
    return { ok: false, error: 'Invalid category update.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('portal_song_categories')
    .update({ label: labelParsed.data })
    .eq('id', idParsed.data);

  if (error) {
    logger.error(
      '[portal-actions] updatePortalSongCategoryAction failed',
      error,
      { userId: user.id, categoryId: id },
    );
    return { ok: false, error: 'Could not rename category.' };
  }

  return { ok: true, data: undefined };
}

export async function deletePortalSongCategoryAction(
  id: string,
): Promise<ActionResult<void>> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: 'Invalid category ID.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('portal_song_categories')
    .delete()
    .eq('id', parsed.data);

  if (error) {
    logger.error(
      '[portal-actions] deletePortalSongCategoryAction failed',
      error,
      { userId: user.id, categoryId: id },
    );
    return { ok: false, error: 'Could not remove category.' };
  }

  return { ok: true, data: undefined };
}

/* ─── Portal files ────────────────────────────────────────────── */

const addFileSchema = z.object({
  couple_id: uuidSchema,
  name: z.string().trim().min(1).max(500),
  file_url: z.string().trim().min(1).max(2000),
  // Postgres column is integer; cap at 100 MB to mirror the client-
  // side upload guard.
  file_size: z.number().int().min(0).max(100 * 1024 * 1024).nullable().default(null),
});

export type AddPortalFileInput = z.input<typeof addFileSchema>;

export async function addPortalFileAction(
  input: AddPortalFileInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = addFileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid file data.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('portal_files')
    .insert({ ...parsed.data, user_id: user.id })
    .select('id')
    .single();

  if (error || !data) {
    logger.error('[portal-actions] addPortalFileAction failed', error, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not save file metadata.' };
  }

  return { ok: true, data: { id: data.id } };
}

export async function deletePortalFileAction(
  id: string,
): Promise<ActionResult<void>> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: 'Invalid file ID.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('portal_files')
    .delete()
    .eq('id', parsed.data);

  if (error) {
    logger.error('[portal-actions] deletePortalFileAction failed', error, {
      userId: user.id,
      fileId: id,
    });
    return { ok: false, error: 'Could not remove file.' };
  }

  return { ok: true, data: undefined };
}

/* ─── Couple contacts (MC contacts tab) ───────────────────────── */
//
// The MC Contacts tab inside the Couple Profile reads from
// `couple_contacts` joined to `contacts`. The link rows + the
// underlying contact row are both writable from this surface.
// We expose actions for the four operations the UI needs:
// add a link, remove a link, edit a contact's fields, delete the
// contact entirely.

const addCoupleContactSchema = z.object({
  couple_id: uuidSchema,
  contact_id: uuidSchema,
});

export async function addCoupleContactLinkAction(
  input: z.input<typeof addCoupleContactSchema>,
): Promise<ActionResult<void>> {
  const parsed = addCoupleContactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid link payload.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase.from('couple_contacts').insert({
    user_id: user.id,
    couple_id: parsed.data.couple_id,
    contact_id: parsed.data.contact_id,
  });

  if (error) {
    logger.error(
      '[portal-actions] addCoupleContactLinkAction failed',
      error,
      { userId: user.id, ...parsed.data },
    );
    return { ok: false, error: 'Could not link contact.' };
  }

  return { ok: true, data: undefined };
}

export async function deleteCoupleContactLinkAction(
  joinRowId: string,
): Promise<ActionResult<void>> {
  const parsed = uuidSchema.safeParse(joinRowId);
  if (!parsed.success) return { ok: false, error: 'Invalid link ID.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('couple_contacts')
    .delete()
    .eq('id', parsed.data);

  if (error) {
    logger.error(
      '[portal-actions] deleteCoupleContactLinkAction failed',
      error,
      { userId: user.id, joinRowId },
    );
    return { ok: false, error: 'Could not unlink contact.' };
  }

  return { ok: true, data: undefined };
}

const updateContactSchema = z.object({
  id: uuidSchema,
  patch: z
    .object({
      name: z.string().trim().min(1).max(200).optional(),
      email: z.string().trim().max(200).optional(),
      phone: z.string().trim().max(50).optional(),
      contact_name: z.string().trim().max(200).optional(),
      category: z.string().trim().min(1).max(100).optional(),
      notes: z.string().max(5000).optional(),
    })
    .refine((p) => Object.keys(p).length > 0, {
      message: 'Patch must contain at least one field',
    }),
});

export async function updateContactAction(
  input: z.input<typeof updateContactSchema>,
): Promise<ActionResult<void>> {
  const parsed = updateContactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid contact patch.' };
  const { id, patch } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const compact = compactPatch(patch);
  const { error } = await supabase
    .from('contacts')
    .update(compact)
    .eq('id', id);

  if (error) {
    logger.error('[portal-actions] updateContactAction failed', error, {
      userId: user.id,
      contactId: id,
    });
    return { ok: false, error: 'Could not update contact.' };
  }

  return { ok: true, data: undefined };
}

export async function deleteContactAction(
  id: string,
): Promise<ActionResult<void>> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: 'Invalid contact ID.' };

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
    logger.error('[portal-actions] deleteContactAction failed', error, {
      userId: user.id,
      contactId: id,
    });
    return { ok: false, error: 'Could not delete contact.' };
  }

  return { ok: true, data: undefined };
}

/* ─── Timeline-item review approval ───────────────────────────── */

export async function approveTimelineItemAction(
  id: string,
): Promise<ActionResult<void>> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: 'Invalid item ID.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('timeline_items')
    .update({ pending_review: false })
    .eq('id', parsed.data);

  if (error) {
    logger.error(
      '[portal-actions] approveTimelineItemAction failed',
      error,
      { userId: user.id, itemId: id },
    );
    return { ok: false, error: 'Could not approve item.' };
  }

  return { ok: true, data: undefined };
}

/* ─── Helpers ────────────────────────────────────────────────── */

/**
 * Strip undefined-valued keys from a parsed Zod patch. Zod
 * `.optional()` produces `T | undefined`; Supabase `Update<Row>`
 * types reject `undefined` under exactOptionalPropertyTypes.
 */
function compactPatch<T extends Record<string, unknown>>(
  patch: T,
): { [K in keyof T]: Exclude<T[K], undefined> } {
  const result = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) result[k] = v;
  }
  return result as { [K in keyof T]: Exclude<T[K], undefined> };
}
