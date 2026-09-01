'use client';

/**
 * React Query read for a couple's scripts. Reads go straight through the
 * RLS-scoped browser client (same as Vows and Files); writes go through the
 * server actions in `script-actions.ts` and invalidate this key.
 *
 * @module app/(dashboard)/couples/use-couple-scripts
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { JSONContent } from '@tiptap/core';

import { DEFAULT_SCRIPT_FONT, isScriptFontId, type ScriptFontId } from '@/lib/documents/script-fonts';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

type ScriptRow = Database['public']['Tables']['scripts']['Row'];

/** A script as the tab uses it: the row with `content` and `font` narrowed. */
export interface CoupleScript {
  id: string;
  couple_id: string;
  title: string;
  content: JSONContent;
  font: ScriptFontId;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Query key for a couple's scripts; exported so mutations can invalidate it. */
export const coupleScriptsKey = (coupleId: string) => ['couple-scripts', coupleId] as const;

/**
 * Narrow a DB row to {@link CoupleScript}. An unknown stored font (a face
 * removed from the catalogue) falls back to the default so the editor never
 * receives an id it cannot render.
 */
export function toCoupleScript(row: ScriptRow): CoupleScript {
  return {
    ...row,
    content: (row.content ?? { type: 'doc' }) as JSONContent,
    font: isScriptFontId(row.font) ? row.font : DEFAULT_SCRIPT_FONT,
  };
}

/** Load a couple's scripts in display order. */
export function useCoupleScripts(coupleId: string) {
  return useQuery({
    queryKey: coupleScriptsKey(coupleId),
    queryFn: async (): Promise<CoupleScript[]> => {
      const { data, error } = await createClient()
        .from('scripts')
        .select('*')
        .eq('couple_id', coupleId)
        .order('sort_order')
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map(toCoupleScript);
    },
  });
}

/** Invalidate a couple's scripts after a write. */
export function useInvalidateCoupleScripts(coupleId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: coupleScriptsKey(coupleId) });
}
