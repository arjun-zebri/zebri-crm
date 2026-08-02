/**
 * Client hook: fetch the current user's branding for live preview.
 *
 * The public payment pages get their branding via the
 * `get_public_invoice` RPC, which assembles a `PublicBranding`
 * shape from `user_metadata` + the `user_branding` table. Inside the
 * builder modal we don't have a saved share-token yet — and even when
 * we do, fetching the public RPC for our own draft is wasteful — so
 * this hook does the equivalent assembly on the client.
 *
 * Returns:
 * - `branding` — a `PublicBranding`-shaped object the existing
 *   `PublicBlockRenderer` can consume directly.
 * - `blocks` — the saved block tree for the chosen surface. Falls
 *   back to `defaultBlocksFor()` when the user hasn't customised
 *   this surface.
 * - `brandLabel` — the display name of the active brand kit, for the
 *   "Branded as …" line in the builder preview pane.
 * - `loading` — true while the first fetch is in flight.
 *
 * Backed by React Query keyed on the surface, so the several consumers
 * that co-exist inside one builder modal (the PDF tab, the Link tab,
 * the preview pane header, and the modal itself for its skeleton gate)
 * share a single fetch instead of each firing their own. That shared
 * cache is also what lets a parent gate its loading skeleton on
 * branding being ready.
 *
 * @module lib/branding/use-current-branding
 */
'use client';

import { useQuery } from '@tanstack/react-query';

// The block default + type helpers live under app/(dashboard)/branding/
// because they're consumed primarily by the editor surface there.
// This hook is the one acceptable bridge that pulls them into a
// lib-level data helper for the builder preview. Layering exception
// noted in `.claude/docs/component-library.md`.
// eslint-disable-next-line no-restricted-imports
import { defaultBlocksFor } from '@/app/(dashboard)/branding/blocks/defaults';
// eslint-disable-next-line no-restricted-imports
import type { Block } from '@/app/(dashboard)/branding/blocks/types';
import { repairBlocks } from '@/lib/branding/validate-blocks';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/supabase/current-user';

import { buildPublicBranding, type PublicBranding, type UserMetadata } from './public-branding';

// The pure assembly moved to `./public-branding` so server code can use
// it; re-exported here so existing client imports keep working.
export { buildPublicBranding } from './public-branding';
export type { UserMetadata } from './public-branding';

export type BuilderSurface = 'invoice' | 'contract' | 'portal' | 'vendorTimeline' | 'questionnaire';

export interface UseCurrentBrandingResult {
  branding: PublicBranding | null;
  blocks: Block[];
  /** Active brand-kit display name, or null when nothing is named. */
  brandLabel: string | null;
  loading: boolean;
}

interface UserBrandingRow {
  branding_blocks: {
    invoice?: Block[];
    contract?: Block[];
    portal?: Block[];
    vendorTimeline?: Block[];
    questionnaire?: Block[];
  } | null;
}

/**
 * Brand-kit naming fields. Kept local rather than added to the shared
 * `UserMetadata` shape, which exists to describe the branding scalars
 * `buildPublicBranding()` consumes — kit identity isn't one of those.
 */
interface KitMetadata {
  active_kit_id?: string | null;
  brand_kits?: { id: string; name?: string }[];
  brand_kit_name?: string;
  business_name?: string;
}

/**
 * Resolve the active brand-kit display name.
 *
 * Preference order:
 *   1. `active_kit_id` → match in `brand_kits[]` by id → kit.name
 *   2. `brand_kit_name` (legacy default-kit field)
 *   3. `business_name` (fallback while a kit isn't named)
 * Null when none of these are set, which callers render as
 * "Using default branding".
 */
function resolveBrandLabel(meta: KitMetadata): string | null {
  const kit = meta.active_kit_id
    ? meta.brand_kits?.find((k) => k.id === meta.active_kit_id)
    : undefined;
  return (
    kit?.name?.trim() ||
    meta.brand_kit_name?.trim() ||
    meta.business_name?.trim() ||
    null
  );
}

export function useCurrentBranding(surface: BuilderSurface): UseCurrentBrandingResult {
  const { data, isPending } = useQuery({
    queryKey: ['current-branding', surface],
    // The app-wide default is a 60s staleTime, which would let a builder
    // modal opened right after a trip to /branding render the old design.
    // Opting out restores the previous per-mount fetch, while React Query
    // still collapses the several simultaneous consumers into one request.
    staleTime: 0,
    queryFn: async () => {
      const supabase = createClient();
      const [user, { data: brandingRow }] = await Promise.all([
        getCurrentUser(),
        supabase.from('user_branding').select('branding_blocks').maybeSingle(),
      ]);
      const metadata = (user?.user_metadata ?? {}) as UserMetadata;
      const row = (brandingRow as UserBrandingRow | null) ?? null;
      const surfaceBlocks = row?.branding_blocks?.[surface];
      return {
        branding: buildPublicBranding(metadata),
        // Run the same migrate/repair the editor and public pages apply, so the
        // preview matches (e.g. invoices drop the secondary action button). Loading
        // raw blocks here previously let stale/legacy shapes render only in preview.
        blocks: surfaceBlocks
          ? repairBlocks(surface, surfaceBlocks)
          : defaultBlocksFor(surface),
        brandLabel: resolveBrandLabel((user?.user_metadata ?? {}) as KitMetadata),
      };
    },
  });

  return {
    branding: data?.branding ?? null,
    blocks: data?.blocks ?? [],
    brandLabel: data?.brandLabel ?? null,
    loading: isPending,
  };
}
