/**
 * Right-pane preview for the Contract builder modal.
 *
 * Mirrors what the couple sees on `/contract/[token]` — branded
 * card with the MC's colours / fonts / corner radius applied, the
 * contract HTML rendered with the canonical `.contract-content`
 * styles (same class the public page uses, so heading sizes / list
 * styles / paragraph spacing match exactly), an MC
 * countersignature block in Caveat cursive, and a placeholder
 * "Sign to accept" section so the MC sees the full surface their
 * couple will encounter.
 *
 * Branding is fetched from `user_metadata` once on mount. Updates
 * to the MC's branding kit propagate on next modal open. The
 * "Branded as {kit}" header link points at `/branding` for direct
 * editing.
 *
 * @module components/builders/parts/contract-preview-pane
 */
'use client';

import { Check, ExternalLink, Palette } from 'lucide-react';
import { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

interface PreviewBranding {
  brand_color: string;
  surface_color: string;
  text_color: string;
  muted_color: string;
  font_heading: string;
  font_body: string;
  font_weight: number;
  corner_radius: number;
  business_name: string;
  mc_signature_name: string;
  brand_kit_label: string | null;
}

const FALLBACK_BRANDING: PreviewBranding = {
  brand_color: '#000000',
  surface_color: '#ffffff',
  text_color: '#111827',
  muted_color: '#6B7280',
  font_heading: 'Inter, system-ui, sans-serif',
  font_body: 'Inter, system-ui, sans-serif',
  font_weight: 600,
  corner_radius: 16,
  business_name: '',
  mc_signature_name: '',
  brand_kit_label: null,
};

export interface ContractPreviewPaneProps {
  /** Rendered HTML to display — built upstream from either the
   *  TipTap content (draft) or the locked snapshot. */
  html: string;
  /** Human-readable contract number / title for the header. */
  documentNumber: string;
  /** The couple's name — appears as the placeholder in the
   *  signature input so the preview reads naturally. */
  coupleName: string;
}

export function ContractPreviewPane({
  html,
  documentNumber,
  coupleName,
}: ContractPreviewPaneProps) {
  const [branding, setBranding] = useState<PreviewBranding>(FALLBACK_BRANDING);

  // Pull the MC's branding from user_metadata + resolve the
  // "Branded as {kit}" label (active_kit → kits[].name fallback
  // chain matches builder-preview-pane.tsx).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
      const activeKitId = meta.active_kit_id as string | undefined;
      const kits = (meta.brand_kits ?? []) as Array<{ id: string; name: string }>;
      const kitName = activeKitId
        ? kits.find((k) => k.id === activeKitId)?.name ?? null
        : null;
      const brandKitLabel =
        kitName ??
        (meta.brand_kit_name as string | undefined) ??
        (meta.business_name as string | undefined) ??
        null;

      if (cancelled) return;
      setBranding({
        brand_color: (meta.brand_color as string) || FALLBACK_BRANDING.brand_color,
        surface_color:
          (meta.surface_color as string) || FALLBACK_BRANDING.surface_color,
        text_color: (meta.text_color as string) || FALLBACK_BRANDING.text_color,
        muted_color: (meta.muted_color as string) || FALLBACK_BRANDING.muted_color,
        font_heading:
          (meta.font_heading_family as string) ||
          FALLBACK_BRANDING.font_heading,
        font_body:
          (meta.font_body_family as string) || FALLBACK_BRANDING.font_body,
        font_weight: (meta.font_weight as number) ?? FALLBACK_BRANDING.font_weight,
        corner_radius:
          (meta.corner_radius as number) ?? FALLBACK_BRANDING.corner_radius,
        business_name: (meta.business_name as string) || '',
        mc_signature_name:
          (meta.mc_signature_name as string) ||
          (meta.display_name as string) ||
          (meta.business_name as string) ||
          '',
        brand_kit_label: brandKitLabel,
      });
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-surface-muted/60 p-4 sm:p-5 rounded-card">
      {/* Header — matches the BuilderPreviewPane visual language. */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-caption text-text-muted">
          <Palette size={12} strokeWidth={1.5} />
          {branding.brand_kit_label ? (
            <span>
              Branded as{' '}
              <span className="text-text">{branding.brand_kit_label}</span>
            </span>
          ) : (
            <span>Branded preview</span>
          )}
        </div>
        <a
          href="/branding"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-caption text-text-muted hover:text-text transition-colors"
        >
          Update branding <ExternalLink size={11} strokeWidth={1.5} />
        </a>
      </div>

      {/* Branded card — couple-facing rendering. */}
      <div
        className="flex-1 overflow-y-auto border border-border p-6 sm:p-8 space-y-6"
        style={{
          backgroundColor: branding.surface_color,
          color: branding.text_color,
          borderRadius: branding.corner_radius,
          fontFamily: branding.font_body,
        }}
      >
        <p
          className="text-caption font-medium uppercase tracking-wider"
          style={{ color: branding.muted_color, fontFamily: branding.font_body }}
        >
          {documentNumber}
        </p>

        {/* Contract body — uses the same `.contract-content` class as
            the public page (defined in app/globals.css), so heading
            sizes / paragraph spacing / list markers match exactly. */}
        <div
          className="contract-content text-sm"
          style={{ color: branding.text_color, fontFamily: branding.font_body }}
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* MC countersignature — matches the public-page layout
            (Caveat cursive font, muted "Signed by MC" label). */}
        <div className="border-t pt-6" style={{ borderColor: branding.muted_color + '30' }}>
          <p
            className="text-xs font-medium mb-1"
            style={{ color: branding.muted_color }}
          >
            Signed by MC
          </p>
          <p
            className="text-xl"
            style={{
              color: branding.text_color,
              fontFamily: 'Caveat, "Brush Script MT", cursive',
            }}
          >
            {branding.mc_signature_name || 'Your MC'}
          </p>
          {branding.business_name ? (
            <p
              className="text-xs mt-1"
              style={{ color: branding.muted_color }}
            >
              {branding.business_name}
            </p>
          ) : null}
        </div>

        {/* Couple signature placeholder — non-functional preview of
            what the couple will see + interact with on the live page.
            Shows the signature affordance shape so the MC can verify
            "yes, my couple will be asked to type their name + tick
            consent + click Sign." */}
        <div
          className="border-t pt-6 space-y-4"
          style={{ borderColor: branding.muted_color + '30' }}
        >
          <p
            className="text-xs font-medium"
            style={{ color: branding.muted_color }}
          >
            Sign to accept
          </p>
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: branding.muted_color }}
            >
              Your full legal name
            </label>
            <input
              type="text"
              placeholder={coupleName}
              readOnly
              tabIndex={-1}
              aria-hidden="true"
              className="w-full text-sm border px-3 py-2.5 cursor-not-allowed bg-surface-muted/30"
              style={{
                borderRadius: branding.corner_radius,
                borderColor: branding.muted_color + '30',
                color: branding.text_color,
              }}
            />
          </div>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={false}
              readOnly
              tabIndex={-1}
              aria-hidden="true"
              className="mt-0.5 w-4 h-4 cursor-not-allowed"
            />
            <span className="text-sm" style={{ color: branding.text_color }}>
              I agree to the terms above and intend my typed name to serve as
              my legal signature.
            </span>
          </label>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              disabled
              style={{
                backgroundColor: branding.brand_color,
                color: '#ffffff',
                borderRadius: branding.corner_radius,
              }}
              className="text-sm font-semibold px-5 py-2.5 inline-flex items-center gap-2 cursor-not-allowed opacity-90"
            >
              <Check size={14} strokeWidth={2} /> Sign contract
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              disabled
              style={{
                borderRadius: branding.corner_radius,
                borderColor: branding.muted_color + '40',
                color: branding.muted_color,
              }}
              className="text-sm font-medium px-4 py-2.5 border cursor-not-allowed"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
