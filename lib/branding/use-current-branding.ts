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

import {
  HEADING_FONTS,
  BODY_FONTS,
  type BodyFont,
  type FontWeight,
  type HeadingFont,
} from './fonts';
import { type PublicBranding } from './public-surface';
import { THEME_PRESETS } from './themes';

export type BuilderSurface = 'quote' | 'invoice' | 'contract';

export interface UseCurrentBrandingResult {
  branding: PublicBranding | null;
  blocks: Block[];
  loading: boolean;
}

interface UserMetadata {
  logo_url?: string;
  favicon_url?: string;
  header_image_url?: string;
  brand_color?: string;
  accent_color?: string;
  surface_color?: string;
  text_color?: string;
  muted_color?: string;
  secondary_color?: string;
  secondary_text_color?: string;
  business_name?: string;
  tagline?: string;
  abn?: string;
  phone?: string;
  website?: string;
  instagram_url?: string;
  facebook_url?: string;
  show_contact_on_documents?: boolean;
  font_heading?: string;
  font_body?: string;
  font_weight?: number;
  font_body_weight?: number;
  font_scale?: number;
  density?: 'compact' | 'cozy' | 'roomy';
  corner_radius?: number;
  theme_preset?: string;
  bank_account_name?: string;
  bank_bsb?: string;
  bank_account_number?: string;
}

interface UserBrandingRow {
  branding_blocks: {
    quote?: Block[];
    invoice?: Block[];
    contract?: Block[];
    portal?: Block[];
  } | null;
}

function sanitizeHeadingFont(v: string | undefined, fallback: HeadingFont): HeadingFont {
  return HEADING_FONTS.includes(v as HeadingFont) ? (v as HeadingFont) : fallback;
}

function sanitizeBodyFont(v: string | undefined, fallback: BodyFont): BodyFont {
  return BODY_FONTS.includes(v as BodyFont) ? (v as BodyFont) : fallback;
}

function sanitizeWeight(v: number | undefined, fallback: FontWeight): FontWeight {
  const allowed = [400, 500, 600, 700] as const;
  return (allowed.includes(v as 400) ? v : fallback) as FontWeight;
}

/**
 * Assemble a `PublicBranding` object from `user_metadata` + an
 * optional theme preset fallback. Pure — exported separately so
 * tests can build a branding without standing up the hook.
 */
export function buildPublicBranding(metadata: UserMetadata): PublicBranding {
  const themeId = metadata.theme_preset ?? 'minimal';
  const fallback =
    themeId === 'custom' ? THEME_PRESETS.minimal! : (THEME_PRESETS[themeId] ?? THEME_PRESETS.minimal!);

  return {
    logo_url: metadata.logo_url ?? null,
    favicon_url: metadata.favicon_url ?? null,
    header_image_url: metadata.header_image_url ?? null,
    brand_color: metadata.brand_color ?? fallback.color,
    accent_color: metadata.accent_color ?? fallback.accent,
    surface_color: metadata.surface_color ?? fallback.surface,
    text_color: metadata.text_color ?? fallback.text,
    muted_color: metadata.muted_color ?? fallback.muted,
    secondary_color: metadata.secondary_color ?? '#FFFFFF',
    secondary_text_color: metadata.secondary_text_color ?? '#374151',
    business_name: metadata.business_name ?? null,
    tagline: metadata.tagline ?? null,
    abn: metadata.abn ?? null,
    phone: metadata.phone ?? null,
    website: metadata.website ?? null,
    instagram_url: metadata.instagram_url ?? null,
    facebook_url: metadata.facebook_url ?? null,
    show_contact_on_documents: metadata.show_contact_on_documents ?? true,
    bank_account_name: metadata.bank_account_name ?? null,
    bank_bsb: metadata.bank_bsb ?? null,
    bank_account_number: metadata.bank_account_number ?? null,
    font_heading: sanitizeHeadingFont(metadata.font_heading, fallback.headingFont),
    font_body: sanitizeBodyFont(metadata.font_body, fallback.bodyFont),
    font_weight: sanitizeWeight(metadata.font_weight, fallback.headingWeight),
    font_body_weight: sanitizeWeight(metadata.font_body_weight, fallback.bodyWeight),
    font_scale: typeof metadata.font_scale === 'number' ? metadata.font_scale : fallback.scale,
    density: metadata.density ?? fallback.density,
    corner_radius:
      typeof metadata.corner_radius === 'number' ? metadata.corner_radius : fallback.radius,
    theme_preset: themeId,
  };
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
      const surfaceBlocks = row?.branding_blocks?.[surface];
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
