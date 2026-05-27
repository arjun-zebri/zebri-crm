/**
 * Right-pane preview for the Contract builder modal.
 *
 * Mirrors `/contract/[token]` exactly:
 *
 * 1. `PublicBlockRenderer` renders the MC's customised block tree —
 *    branded header (logo + business name + tagline), title block
 *    (large heading + couple name + ref/ABN), any extra blocks the
 *    MC has added on the Contract surface in the branding editor.
 * 2. The contract HTML body — uses the canonical `.contract-content`
 *    CSS class so heading / list / paragraph styles match the live
 *    page byte-for-byte.
 * 3. MC countersignature block — typed name rendered in Caveat
 *    cursive.
 * 4. A non-functional couple-signature placeholder so the MC can
 *    visually verify the affordance their couple will see.
 *
 * Uses `useCurrentBranding('contract')` to pick up the same
 * branding context the quote/invoice previews use. `useBrandingHead`
 * injects the user's favicon + font links into the document head
 * so Caveat / branded heading fonts actually render.
 *
 * @module components/builders/parts/contract-preview-pane
 */
'use client';

import { Check, ExternalLink, Palette } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  PublicBlockRenderer,
  type PublicDocData,
} from '@/lib/branding/public-renderer';
import {
  bodyFontFamily,
  DENSITY_PAD,
  headingFontFamily,
  useBrandingHead,
} from '@/lib/branding/public-surface';
import { htmlToPlainText } from '@/lib/branding/sanitize';
import { useCurrentBranding } from '@/lib/branding/use-current-branding';
import { createClient } from '@/lib/supabase/client';

export interface ContractPreviewPaneProps {
  /** Rendered contract body HTML — built upstream from either the
   *  TipTap content (draft) or the locked snapshot (sent+). */
  html: string;
  /** e.g. `CTR-004` — appears in the title block via the block
   *  tree's `refNumber` slot. */
  documentNumber: string;
  /** Doc title for the title block. */
  title: string;
  /** Couple's name — appears in the title block subtitle + as the
   *  signature input placeholder. */
  coupleName: string;
  /** Optional expiry — feeds the title block's `expiresAt` slot. */
  expiresAt: string | null;
}

export function ContractPreviewPane({
  html,
  documentNumber,
  title,
  coupleName,
  expiresAt,
}: ContractPreviewPaneProps) {
  const { branding, blocks, loading } = useCurrentBranding('contract');
  useBrandingHead(branding);

  // MC signature name comes from `user_metadata.mc_signature_name`
  // (or display_name / business_name fallbacks) — see the public
  // contract page for the same lookup chain.
  const [mcSignatureName, setMcSignatureName] = useState<string>('');
  const [mcBusinessName, setMcBusinessName] = useState<string>('');
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
      setMcSignatureName(
        (meta.mc_signature_name as string) ||
          (meta.display_name as string) ||
          (meta.business_name as string) ||
          '',
      );
      setMcBusinessName(htmlToPlainText((meta.business_name as string) ?? ''));
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !branding) {
    return (
      <div className="flex h-full items-center justify-center rounded-card border border-border bg-surface-muted/40">
        <div className="h-3 w-32 animate-pulse rounded bg-surface-muted" />
      </div>
    );
  }

  // PublicDocData feeds the block-tree's title / refNumber / ABN
  // slots. Contracts don't have line items or tax, so we pass
  // empty/zero — the block tree doesn't render a lineItems block on
  // the contract surface anyway (it's structurally absent from the
  // contract defaults).
  const publicDoc: PublicDocData = {
    title,
    refNumber: documentNumber,
    expiresAt: expiresAt ?? null,
    items: [],
    subtotal: 0,
    taxRate: 0,
  };

  // Split the block tree at the `contractBody` marker — chrome above
  // (logo, business name, title), the actual contract body rendered
  // in Zebri's signature layout in the middle, then any post-blocks
  // (custom footer text, divider, etc) after. Same pattern the
  // portal page uses for `couplePortal`. When no marker exists
  // (legacy data) the entire tree renders before the body so we
  // never lose blocks the MC set up.
  const markerIndex = blocks.findIndex((b) => b.type === 'contractBody');
  const preBlocks = markerIndex >= 0 ? blocks.slice(0, markerIndex) : blocks;
  const postBlocks = markerIndex >= 0 ? blocks.slice(markerIndex + 1) : [];

  const padding = DENSITY_PAD[branding.density];
  const bg = branding.secondary_color || branding.surface_color;
  // PublicBranding doesn't carry a brand-kit name; the closest user-
  // visible label is `business_name`. Sanitise HTML if the value
  // came from the editor's rich-text field.
  const brandKitLabel = branding.business_name
    ? htmlToPlainText(branding.business_name)
    : null;

  return (
    <div className="flex flex-col h-full bg-surface-muted/60 p-4 sm:p-5 rounded-card">
      {/* Header — matches the BuilderPreviewPane visual language. */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-caption text-text-muted">
          <Palette size={12} strokeWidth={1.5} />
          {brandKitLabel ? (
            <span>
              Branded as{' '}
              <span className="text-text">{brandKitLabel}</span>
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

      {/* Branded surface — identical layout to the public
          /contract/[token] page. */}
      <div
        className={`h-full overflow-y-auto rounded-card border border-border ${padding.page}`}
        style={{
          backgroundColor: bg,
          color: branding.text_color,
          fontFamily: bodyFontFamily(branding),
          fontWeight: branding.font_body_weight,
        }}
      >
        <div
          className="mx-auto"
          style={{
            maxWidth: 640,
            fontSize: `${(branding.font_scale ?? 1) * 16}px`,
            fontFamily: headingFontFamily(branding),
          }}
        >
          {/* Pre-marker blocks — chrome that renders ABOVE the
              contract body (logo, business name, title block,
              optional custom intro blocks). */}
          <PublicBlockRenderer
            blocks={preBlocks}
            branding={branding}
            doc={publicDoc}
            hideAction
          />

          {/* Contract body — uses `.contract-content` so heading
              sizes / list markers / paragraph spacing match the
              public page exactly. */}
          <div className={padding.cardSection}>
            <div
              className="contract-content text-sm"
              style={{
                color: branding.text_color,
                fontFamily: bodyFontFamily(branding),
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>

          {/* MC countersignature */}
          <div
            className={`${padding.cardSection} border-t`}
            style={{ borderColor: branding.muted_color + '30' }}
          >
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
              {mcSignatureName || 'Your MC'}
            </p>
            {mcBusinessName ? (
              <p
                className="text-xs mt-1"
                style={{ color: branding.muted_color }}
              >
                {mcBusinessName}
              </p>
            ) : null}
          </div>

          {/* Couple signature placeholder — non-functional preview
              of the input + checkbox + Sign/Decline affordances. */}
          <div
            className={`${padding.cardSection} border-t space-y-4`}
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

          {/* Post-marker blocks — anything the MC put BELOW the
              contractBody marker (custom footer text, divider, etc). */}
          {postBlocks.length > 0 ? (
            <PublicBlockRenderer
              blocks={postBlocks}
              branding={branding}
              doc={publicDoc}
              hideAction
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
