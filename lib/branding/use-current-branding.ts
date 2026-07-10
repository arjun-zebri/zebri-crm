/**
 * Client hook: fetch the current user's branding for live preview.
 *
 * The public payment pages get their branding via the
 * `get_public_{quote,invoice}` RPCs, which assemble a `PublicBranding`
 * shape from `user_metadata` + the `user_branding` table. Inside the
 * builder modal we don't have a saved share-token yet — and even when
 * we do, fetching the public RPC for our own draft is wasteful — so
 * this hook does the equivalent assembly on the client.
 *
 * Returns:
 * - `branding` — a `PublicBranding`-shaped object the existing
 *   `PublicBlockRenderer` can consume directly.
 * - `blocks` — the saved block tree for the chosen surface (quote
 *   or invoice). Falls back to `defaultBlocksFor()` when the user
 *   hasn't customised this surface.
 * - `loading` — true while the first fetch is in flight.
 *
 * @module lib/branding/use-current-branding
 */
'use client';

import { useEffect, useState } from 'react';

// The block default + type helpers live under app/(dashboard)/branding/
// because they're consumed primarily by the editor surface there.
// This hook is the one acceptable bridge that pulls them into a
// lib-level data helper for the builder preview. Layering exception
// noted in `.claude/docs/component-library.md`.
// eslint-disable-next-line no-restricted-imports
import { defaultBlocksFor } from '@/app/(dashboard)/branding/blocks/defaults';
// eslint-disable-next-line no-restricted-imports
import type { Block } from '@/app/(dashboard)/branding/blocks/types';
import { createClient } from '@/lib/supabase/client';

import { buildPublicBranding, type PublicBranding, type UserMetadata } from './public-branding';

// The pure assembly moved to `./public-branding` so server code can use
// it; re-exported here so existing client imports keep working.
export { buildPublicBranding } from './public-branding';
export type { UserMetadata } from './public-branding';

export type BuilderSurface = 'proposal' | 'invoice' | 'contract';

export interface UseCurrentBrandingResult {
  branding: PublicBranding | null;
  blocks: Block[];
  loading: boolean;
}

interface UserBrandingRow {
  branding_blocks: {
    proposal?: Block[];
    /** Legacy key from before the proposals rollout — old rows keep
     *  their saved design until the MC re-saves under `proposal`. */
    quote?: Block[];
    invoice?: Block[];
    contract?: Block[];
    portal?: Block[];
  } | null;
}

export function useCurrentBranding(surface: BuilderSurface): UseCurrentBrandingResult {
  const [branding, setBranding] = useState<PublicBranding | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const [{ data: userResult }, { data: brandingRow }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('user_branding').select('branding_blocks').maybeSingle(),
      ]);
      if (cancelled) return;
      const metadata = (userResult.user?.user_metadata ?? {}) as UserMetadata;
      const row = (brandingRow as UserBrandingRow | null) ?? null;
      // The proposal surface falls back to the legacy `quote` key so
      // pre-rollout saved designs keep rendering.
      const surfaceBlocks =
        surface === 'proposal'
          ? row?.branding_blocks?.proposal ?? row?.branding_blocks?.quote
          : row?.branding_blocks?.[surface];
      setBranding(buildPublicBranding(metadata));
      setBlocks(surfaceBlocks ?? defaultBlocksFor(surface));
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [surface]);

  return { branding, blocks, loading };
}
