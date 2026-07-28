/**
 * The proposal, exactly as the couple sees it — ONE component, three
 * surfaces:
 * - `/proposal/[token]` (real data + live handlers + accept actions),
 * - the composer's Page preview (draft data + the MC's current
 *   branding, read-only),
 * - the branding editor's Proposal surface (sample data + the kit
 *   values being edited).
 *
 * Keeping the layout in one place is what guarantees the preview, the
 * branding canvas, and the sent page can never drift apart again.
 *
 * The full brand kit flows in: colours (primary / accent / secondary /
 * surface / text / muted), fonts + weight, corner radius, logo,
 * header image, business name, tagline, ABN, and the MC's editable
 * section wording ({@link ProposalViewBranding.labels}). Text sizes,
 * case and tracking come from the user's global brand settings via
 * `roleDefaults()` applied to roles like `sectionLabel`, `body`, and
 * `finePrint`. `docPadding` adds horizontal inset. The section ORDER
 * and structure are fixed by design (a block tree can't express the
 * option chooser) — only the wording + tokens are editable.
 *
 * @module components/proposal/proposal-page-view
 */
'use client';

import type { CSSProperties, ReactNode } from 'react';

import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style';
import { EditableLabel } from '@/components/proposal/editable-label';
import { ProposalOptionChooser } from '@/components/proposal/option-chooser';
import { ProposalSelection } from '@/components/proposal/option-selection';
import { getTextColor } from '@/lib/branding/contrast';
import { FONT_STACKS } from '@/lib/branding/fonts';
import {
  PROPOSAL_LABEL_DEFAULTS,
  resolveProposalLabels,
  type ProposalLabelEdit,
} from '@/lib/branding/proposal-labels';
import type { PublicBranding } from '@/lib/branding/public-surface';
import { htmlToPlainText } from '@/lib/branding/sanitize';
import { applyCase, cssTextTransform } from '@/lib/branding/text-case';
import { roleDefaults } from '@/lib/branding/type-defaults';
import {
  formatDate,
  type ProposalViewBranding,
  type PublicProposalOption,
} from '@/lib/payments/proposal-view';

/** Resolve a {@link PublicBranding} (RPC payload / current-branding
 *  hook / editor kit) into the view's ready-to-apply scalar shape. */
export function viewBranding(b: PublicBranding): ProposalViewBranding {
  return {
    pageBg: b.surface_color || '#fafafa',
    textColor: b.text_color || '#111827',
    mutedColor: b.muted_color || '#6B7280',
    brand: b.brand_color || '#111827',
    accent: b.accent_color || b.brand_color || '#111827',
    secondaryColor: b.secondary_color || '#FFFFFF',
    secondaryTextColor: getTextColor(b.secondary_color ?? '#6B7280'),
    headingColor: b.heading_color ?? b.text_color,
    subheadingColor: b.subheading_color ?? b.muted_color,
    radius: b.corner_radius ?? 16,
    borderColor: b.border_color || '#E5E7EB',
    cornerRadius: b.corner_radius ?? 8,
    headingFontFamily: FONT_STACKS[b.font_heading],
    bodyFontFamily: FONT_STACKS[b.font_body],
    headingWeight: b.font_weight ?? 600,
    docPadding: typeof b.doc_padding === 'number' ? b.doc_padding : 0,
    logoUrl: b.logo_url,
    headerImageUrl: b.header_image_url,
    businessName: b.business_name ? htmlToPlainText(b.business_name) : null,
    tagline: b.tagline ? htmlToPlainText(b.tagline) : null,
    abn: b.abn || null,
    labels: resolveProposalLabels(b.proposal_labels),
  };
}

export interface ProposalPageViewProps {
  coupleName: string;
  proposalNumber: string;
  notes: string | null;
  expiresAt: string | null;
  options: PublicProposalOption[];
  /** Drives which affordances render; previews pass 'active'. */
  state: 'active' | 'accepted' | 'declined' | 'expired';
  /** Branding source for roleDefaults() and role-based text sizing,
   *  case and tracking. Required for consistent type scale integration. */
  publicBranding: PublicBranding;
  branding: ProposalViewBranding;
  chosenId: string | null;
  selection: Record<string, boolean>;
  /** Omit both handlers for a read-only preview. */
  onChoose?: ((optionId: string) => void) | undefined;
  onToggle?: ((itemId: string, next: boolean) => void) | undefined;
  /** The accept/decline block. The public page passes the real one;
   *  previews pass {@link StaticAcceptCta} (or nothing). */
  actions?: ReactNode;
  /** Branding canvas only: makes every section label edit in place. */
  onEditLabel?: ProposalLabelEdit | undefined;
  /**
   * `standalone` (default) renders the whole page — logo, header
   * image, business line, actions slot, footer — used by the composer
   * preview and the public fallback. `blockCore` renders ONLY the
   * proposal-specific core (eyebrow + names + expiry, notes, chooser,
   * priced selection) because the logo, header, accept and footer are
   * separate editable blocks around it.
   */
  variant?: 'standalone' | 'blockCore';
}

export function ProposalPageView({
  coupleName,
  proposalNumber,
  notes,
  expiresAt,
  options,
  state,
  publicBranding,
  branding,
  chosenId,
  selection,
  onChoose,
  onToggle,
  actions,
  onEditLabel,
  variant = 'standalone',
}: ProposalPageViewProps) {
  const { textColor, mutedColor, radius, headingFontFamily, labels } = branding;
  const interactive = state === 'active' && !!onToggle;
  const chosen = options.find((o) => o.id === chosenId) ?? null;
  // In block-core mode the logo, header image, business line, actions
  // and footer are separate editable blocks around this core.
  const core = variant === 'blockCore';

  // Role defaults for global type scale integration.
  const docTitleDefaults = roleDefaults(publicBranding, 'docTitle');
  const sectionLabelDefaults = roleDefaults(publicBranding, 'sectionLabel');
  const bodyDefaults = roleDefaults(publicBranding, 'body');
  const finePrintDefaults = roleDefaults(publicBranding, 'finePrint');

  // docPadding: extra horizontal inset on top of the surface's base.
  const rootStyle: CSSProperties = {
    paddingLeft: branding.docPadding || undefined,
    paddingRight: branding.docPadding || undefined,
  };

  return (
    <div className="space-y-8" style={rootStyle}>
      {/* ─── Header ─── */}
      <header>
        {branding.logoUrl && !core ? (
          // User-uploaded brand asset — no next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt={branding.businessName || 'Logo'}
            className="mb-6 max-h-10 object-contain"
          />
        ) : null}
        <div className="flex items-baseline justify-between gap-4">
          <EditableLabel
            as="p"
            value={applyCase(labels.eyebrow.text, sectionLabelDefaults.textTransform)}
            onCommit={onEditLabel && ((v) => onEditLabel('eyebrow', v))}
            placeholder={PROPOSAL_LABEL_DEFAULTS.eyebrow.text}
            cornerRadius={branding.cornerRadius}
            className="font-semibold"
            style={{
              fontSize: `${sectionLabelDefaults.fontSize}px`,
              color: sectionLabelDefaults.color,
              fontFamily: FONT_STACKS[sectionLabelDefaults.fontFamily as never],
              fontWeight: sectionLabelDefaults.fontWeight,
              lineHeight: sectionLabelDefaults.lineHeight,
              letterSpacing: `${sectionLabelDefaults.letterSpacing}px`,
              textTransform: cssTextTransform(sectionLabelDefaults.textTransform),
              ...resolveTextStyle(labels.eyebrow.style, {
                fontFamily: 'work_sans',
                fontSize: sectionLabelDefaults.fontSize,
                fontWeight: sectionLabelDefaults.fontWeight,
                color: sectionLabelDefaults.color,
                align: 'left',
                lineHeight: sectionLabelDefaults.lineHeight,
                letterSpacing: sectionLabelDefaults.letterSpacing,
              }),
            }}
          />
          {expiresAt && state === 'active' ? (
            <p
              className="shrink-0"
              style={{
                fontSize: `${finePrintDefaults.fontSize}px`,
                color: finePrintDefaults.color,
                fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                fontWeight: finePrintDefaults.fontWeight,
                lineHeight: finePrintDefaults.lineHeight,
                letterSpacing: `${finePrintDefaults.letterSpacing}px`,
              }}
            >
              Expires {formatDate(expiresAt)}
            </p>
          ) : null}
        </div>
        <h1
          className="mt-3 leading-tight"
          style={{
            fontSize: `${docTitleDefaults.fontSize}px`,
            color: docTitleDefaults.color,
            fontFamily: FONT_STACKS[docTitleDefaults.fontFamily as never],
            fontWeight: docTitleDefaults.fontWeight,
            lineHeight: docTitleDefaults.lineHeight,
            letterSpacing: `${docTitleDefaults.letterSpacing}px`,
            textTransform: cssTextTransform(docTitleDefaults.textTransform),
          }}
        >
          {applyCase(coupleName, docTitleDefaults.textTransform)}
        </h1>
        {branding.businessName && !core ? (
          <p
            className="mt-2"
            style={{
              fontSize: `${finePrintDefaults.fontSize}px`,
              color: finePrintDefaults.color,
              fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
              fontWeight: finePrintDefaults.fontWeight,
              lineHeight: finePrintDefaults.lineHeight,
            }}
          >
            A proposal from {branding.businessName}
            {branding.tagline ? ` · ${branding.tagline}` : ''}
          </p>
        ) : null}
      </header>

      {branding.headerImageUrl && !core ? (
        <div className="overflow-hidden" style={{ borderRadius: radius }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={branding.headerImageUrl} alt="" className="block h-56 w-full object-cover" />
        </div>
      ) : null}

      {/* The MC's note leads the page — the personal message, read
          before any packages or pricing. */}
      {notes ? (
        <section>
          <EditableLabel
            as="p"
            value={applyCase(labels.note.text, sectionLabelDefaults.textTransform)}
            onCommit={onEditLabel && ((v) => onEditLabel('note', v))}
            placeholder={PROPOSAL_LABEL_DEFAULTS.note.text}
            cornerRadius={branding.cornerRadius}
            className="font-semibold"
            style={{
              fontSize: `${sectionLabelDefaults.fontSize}px`,
              color: sectionLabelDefaults.color,
              fontFamily: FONT_STACKS[sectionLabelDefaults.fontFamily as never],
              fontWeight: sectionLabelDefaults.fontWeight,
              lineHeight: sectionLabelDefaults.lineHeight,
              letterSpacing: `${sectionLabelDefaults.letterSpacing}px`,
              textTransform: cssTextTransform(sectionLabelDefaults.textTransform),
              ...resolveTextStyle(labels.note.style, {
                fontFamily: 'work_sans',
                fontSize: sectionLabelDefaults.fontSize,
                fontWeight: sectionLabelDefaults.fontWeight,
                color: sectionLabelDefaults.color,
                align: 'left',
                lineHeight: sectionLabelDefaults.lineHeight,
                letterSpacing: sectionLabelDefaults.letterSpacing,
              }),
            }}
          />
          <p
            className="mt-2 italic leading-relaxed whitespace-pre-wrap"
            style={{
              fontSize: `${bodyDefaults.fontSize}px`,
              color: textColor,
              fontFamily: headingFontFamily,
            }}
          >
            {notes}
          </p>
        </section>
      ) : null}

      {/* Multi-option chooser while active; the accepted view pins to
          the recorded choice. */}
      {state === 'active' && options.length > 1 ? (
        <ProposalOptionChooser
          options={options}
          chosenId={chosenId}
          onChoose={onChoose}
          disabled={!onChoose}
          branding={branding}
          publicBranding={publicBranding}
          onEditLabel={onEditLabel}
        />
      ) : null}

      {chosen ? (
        <ProposalSelection
          option={chosen}
          selection={selection}
          onToggle={onToggle}
          locked={!interactive}
          heading={state === 'accepted' ? 'Chosen package' : labels.selected.text}
          headingLabel={state === 'accepted' ? null : labels.selected}
          headingKey={state === 'accepted' ? null : 'selected'}
          branding={branding}
          publicBranding={publicBranding}
          onEditLabel={onEditLabel}
        />
      ) : options.length > 1 ? (
        <p style={{ fontSize: `${bodyDefaults.fontSize}px`, color: mutedColor }}>
          Select a package above to see what&apos;s included.
        </p>
      ) : null}

      {/* Accept + footer are separate editable blocks in block-core
          mode; only the standalone layout renders them here. */}
      {!core ? actions : null}

      {!core ? (
        <div
          className="space-y-0.5 text-center"
          style={{
            fontSize: `${finePrintDefaults.fontSize}px`,
            color: finePrintDefaults.color,
            fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
            fontWeight: finePrintDefaults.fontWeight,
            lineHeight: finePrintDefaults.lineHeight,
          }}
        >
          <p>{proposalNumber}</p>
          {branding.abn ? <p>ABN {branding.abn}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Non-interactive stand-in for the accept block, used by previews so
 *  the MC sees the couple's full page including the CTA. `style` carries
 *  the MC's action-block button colour/radius/wording so the preview
 *  matches the sent page; it falls back to the brand colour + labels. On
 *  the branding canvas `onEditLabel` makes the accept + decline text edit
 *  in place. */
export function StaticAcceptCta({
  expiresAt,
  branding,
  publicBranding,
  onEditLabel,
  style,
  hideDecline = false,
  hideAccept = false,
}: {
  expiresAt: string | null;
  branding: ProposalViewBranding;
  publicBranding: PublicBranding;
  onEditLabel?: ProposalLabelEdit | undefined;
  style?:
    | { color?: string; radius?: number; primaryLabel?: string; secondaryLabel?: string | null; secondaryColor?: string }
    | undefined;
  /** Hide the decline button — for a per-package Accept in a stack. */
  hideDecline?: boolean;
  /** Render only the decline button — the single bottom Decline of a stack. */
  hideAccept?: boolean;
}) {
  const labels = resolveProposalLabels(branding.labels);
  const bodyDefaults = roleDefaults(publicBranding, 'body');
  const finePrintDefaults = roleDefaults(publicBranding, 'finePrint');
  const buttonColor = style?.color ?? branding.brand;
  const buttonRadius = Math.min(style?.radius ?? branding.radius, 14);
  const acceptLabel = style?.primaryLabel || labels.accept.text;
  const declineLabel = style?.secondaryLabel || labels.decline.text;

  // The Decline is a secondary button — same fill/radius the MC set on the
  // action block's secondary in the branding editor, so preview + sent page match.
  const declineColor = style?.secondaryColor ?? branding.secondaryColor;
  const declineButton = (
    <EditableLabel
      as="div"
      value={declineLabel}
      onCommit={onEditLabel && ((v) => onEditLabel('decline', v))}
      placeholder={PROPOSAL_LABEL_DEFAULTS.decline.text}
      cornerRadius={branding.cornerRadius}
      className="w-full py-3.5 text-center font-medium"
      style={{
        fontSize: `${bodyDefaults.fontSize}px`,
        backgroundColor: declineColor,
        color: getTextColor(declineColor),
        borderRadius: buttonRadius,
        ...resolveTextStyle(labels.decline.style, {
          fontFamily: 'work_sans',
          fontSize: bodyDefaults.fontSize,
          fontWeight: 500,
          color: getTextColor(declineColor),
          align: 'center',
          lineHeight: 1.4,
          letterSpacing: 0,
        }),
      }}
    />
  );

  // Decline-only: the single Decline shown once at the bottom of a stack.
  if (hideAccept) return declineButton;

  return (
    <div>
      <EditableLabel
        as="div"
        value={acceptLabel}
        onCommit={onEditLabel && ((v) => onEditLabel('accept', v))}
        placeholder={PROPOSAL_LABEL_DEFAULTS.accept.text}
        cornerRadius={branding.cornerRadius}
        className="w-full py-3.5 text-center font-medium"
        style={{
          fontSize: `${bodyDefaults.fontSize}px`,
          backgroundColor: buttonColor,
          color: getTextColor(buttonColor),
          borderRadius: buttonRadius,
          ...resolveTextStyle(labels.accept.style, {
            fontFamily: 'work_sans',
            fontSize: bodyDefaults.fontSize,
            fontWeight: 500,
            color: getTextColor(buttonColor),
            align: 'center',
            lineHeight: 1.4,
            letterSpacing: 0,
          }),
        }}
      />
      {expiresAt ? (
        <p className="mt-2.5 text-center" style={{ fontSize: `${finePrintDefaults.fontSize}px`, color: branding.mutedColor }}>
          This proposal is held for you until {formatDate(expiresAt)}
        </p>
      ) : null}
      {!hideDecline ? <div className="mt-3">{declineButton}</div> : null}
    </div>
  );
}
