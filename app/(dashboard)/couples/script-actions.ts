/**
 * Server actions for the Scripts tab inside the Couple Profile.
 *
 * Each action validates its input with Zod (schemas live in
 * `lib/documents/script-schemas` because a `'use server'` file may only
 * export async functions), runs against the RLS-scoped Supabase client, and
 * returns a tagged `ActionResult<T>`. Reads stay client-side through
 * `useCoupleScripts`; only writes come through here.
 *
 * @module app/(dashboard)/couples/script-actions
 */
'use server';

import { logger } from '@/lib/alerts/logger';
import { DEFAULT_SCRIPT_FONT } from '@/lib/documents/script-fonts';
import {
  createScriptSchema,
  deleteScriptSchema,
  duplicateScriptSchema,
  updateScriptSchema,
  type CreateScriptInput,
  type UpdateScriptInput,
} from '@/lib/documents/script-schemas';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

import type { ActionResult } from './portal-actions';

/** Create an empty script for a couple. RLS rejects a couple the caller does not own. */
export async function createScriptAction(input: CreateScriptInput): Promise<ActionResult<{ id: string }>> {
  const parsed = createScriptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  // Append after the couple's existing scripts.
  const { data: last } = await supabase
    .from('scripts')
    .select('sort_order')
    .eq('couple_id', parsed.data.couple_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from('scripts')
    .insert({
      user_id: user.id,
      couple_id: parsed.data.couple_id,
      title: parsed.data.title ?? 'Untitled script',
      font: DEFAULT_SCRIPT_FONT,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select('id')
    .single();

  if (error) {
    logger.error('createScriptAction failed', { error: error.message });
    return { ok: false, error: 'Could not create the script' };
  }
  return { ok: true, data: { id: data.id } };
}

/** Update a script's title, content and/or base font. Omitted fields are left untouched. */
export async function updateScriptAction(input: UpdateScriptInput): Promise<ActionResult<{ updated_at: string }>> {
  const parsed = updateScriptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { id, title, content, font } = parsed.data;
  const patch: { title?: string; content?: Json; font?: string } = {};
  if (title !== undefined) patch.title = title;
  if (content !== undefined) patch.content = content as Json;
  if (font !== undefined) patch.font = font;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('scripts')
    .update(patch)
    .eq('id', id)
    .select('updated_at')
    .maybeSingle();

  if (error) {
    logger.error('updateScriptAction failed', { error: error.message });
    return { ok: false, error: 'Could not save the script' };
  }
  // RLS filters a foreign row to nothing rather than erroring.
  if (!data) return { ok: false, error: 'Script not found' };
  return { ok: true, data: { updated_at: data.updated_at } };
}

/** Delete a script. A foreign id is a silent no-op under RLS, which is the right outcome. */
export async function deleteScriptAction(input: { id: string }): Promise<ActionResult<null>> {
  const parsed = deleteScriptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const supabase = await createClient();
  const { error } = await supabase.from('scripts').delete().eq('id', parsed.data.id);
  if (error) {
    logger.error('deleteScriptAction failed', { error: error.message });
    return { ok: false, error: 'Could not delete the script' };
  }
  return { ok: true, data: null };
}

/** Copy a script (title suffixed "copy") to the same couple, placed after the original. */
export async function duplicateScriptAction(input: { id: string }): Promise<ActionResult<{ id: string }>> {
  const parsed = duplicateScriptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data: source } = await supabase
    .from('scripts')
    .select('couple_id, title, content, font, sort_order')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (!source) return { ok: false, error: 'Script not found' };

  const { data, error } = await supabase
    .from('scripts')
    .insert({
      user_id: user.id,
      couple_id: source.couple_id,
      title: `${source.title} copy`.slice(0, 120),
      content: source.content,
      font: source.font,
      sort_order: source.sort_order + 1,
    })
    .select('id')
    .single();

  if (error) {
    logger.error('duplicateScriptAction failed', { error: error.message });
    return { ok: false, error: 'Could not duplicate the script' };
  }
  return { ok: true, data: { id: data.id } };
}
