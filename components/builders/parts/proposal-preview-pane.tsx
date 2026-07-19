/**
 * Right-pane preview for the proposal composer.
 *
 * Two tabs plus a device toggle (same segmented control as the email
 * template editor):
 * - **Page**: the real thing — the shared {@link ProposalDocumentBody}
 *   (the exact block-tree render `/proposal/[token]` uses) fed with the
 *   draft options, the MC's saved proposal blocks, and their CURRENT
 *   branding via `useCurrentBranding`, so the preview matches what the
 *   couple receives: banner, custom blocks, Accept styling, footer/ABN.
 * - **Email**: the cover email the couple receives, rendered from
 *   the real `proposalHtml` template.
 *
 * @module components/builders/parts/proposal-preview-pane
 */
'use client';

import { Globe, Mail, Monitor, Smartphone } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ProposalDocumentBody } from '@/components/proposal/proposal-document-body';
import { StaticAcceptCta, viewBranding } from '@/components/proposal/proposal-page-view';
import { googleFontsHref } from '@/lib/branding/fonts';
import { useCurrentBranding } from '@/lib/branding/use-current-branding';
import { proposalHtml } from '@/lib/email/html';
import type { PublicProposalOption } from '@/lib/payments/proposal-view';

import { optionBaseTotal, type ProposalOptionDraft } from './proposal-option-card';

export interface ProposalPreviewPaneProps {
  proposalNumber: string;
  title: string;
  coupleName: string | null;
  coupleEmail?: string | null;
  businessName: string | null;
  notes: string | null;
  expiresAt?: string | null;
  options: ProposalOptionDraft[];
  shareUrl: string;
}

type Device = 'desktop' | 'mobile';

export function ProposalPreviewPane(props: ProposalPreviewPaneProps) {
  const [tab, setTab] = useState<'page' | 'email'>('page');
  const [device, setDevice] = useState<Device>('desktop');

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1">
          {(
            [
              { id: 'page', label: 'Page', icon: Globe },
              { id: 'email', label: 'Email', icon: Mail },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                tab === id ? 'bg-surface-muted text-text' : 'text-text-muted hover:text-text'
              }`}
            >
              <Icon size={13} strokeWidth={1.5} />
              {label}
            </button>
          ))}
        </div>

        {/* Same segmented device toggle as the email template editor. */}
        <div className="flex items-center rounded-lg bg-surface-muted p-0.5">
          <button
            type="button"
            onClick={() => setDevice('desktop')}
            aria-label="Desktop preview"
            title="Desktop"
            className={`inline-flex h-6 w-7 cursor-pointer items-center justify-center rounded-md transition ${
              device === 'desktop' ? 'bg-card text-text shadow-sm' : 'text-text-subtle hover:text-text'
            }`}
          >
            <Monitor size={13} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => setDevice('mobile')}
            aria-label="Mobile preview"
            title="Mobile"
            className={`inline-flex h-6 w-7 cursor-pointer items-center justify-center rounded-md transition ${
              device === 'mobile' ? 'bg-card text-text shadow-sm' : 'text-text-subtle hover:text-text'
            }`}
          >
            <Smartphone size={13} strokeWidth={1.5} />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-muted p-4">
        {tab === 'page' ? (
          <PagePreview {...props} device={device} />
        ) : (
          <EmailPreview {...props} device={device} />
        )}
      </div>
    </div>
  );
}

/* ─── Page preview ─────────────────────────────────────────────── */

/** Map a composer draft option onto the public payload shape the
 *  shared view consumes. Draft keys stand in for row ids. */
function toViewOption(option: ProposalOptionDraft, index: number): PublicProposalOption {
  return {
    id: option.key,
    title: option.title || `Option ${String(index + 1)}`,
    description: option.description,
    deposit_percent: option.depositPercent,
    gst_inclusive: option.gstInclusive,
    is_popular: option.isPopular,
    subtotal: optionBaseTotal(option),
    position: index,
    items: [
      ...option.items.map((item, i) => ({
        id: item.id,
        description: item.description || 'Untitled item',
        amount: Number(item.amount || 0),
        is_addon: false,
        default_included: false,
        position: i,
      })),
      ...option.addOns.map((addOn, i) => ({
        id: addOn.id,
        description: addOn.description || 'Untitled add-on',
        amount: Number(addOn.amount || 0),
        is_addon: true,
        default_included: addOn.defaultIncluded,
        position: option.items.length + i,
      })),
    ],
  };
}

/**
 * The couple's page, for real: shared view + the MC's live branding.
 * The popular (else first) option renders chosen with its pre-ticks,
 * mirroring the page's own single/multi behaviour.
 */
function PagePreview({
  proposalNumber,
  title,
  coupleName,
  notes,
  expiresAt,
  options,
  device,
}: ProposalPreviewPaneProps & { device: Device }) {
  const { branding: publicBranding, blocks } = useCurrentBranding('proposal');

  // The branded fonts must exist in the dashboard document too —
  // same stylesheet the public page injects, deduped by id.
  useEffect(() => {
    if (!publicBranding) return;
    const id = 'zebri-proposal-preview-fonts';
    const href = googleFontsHref([publicBranding.font_heading, publicBranding.font_body]);
    const existing = document.getElementById(id) as HTMLLinkElement | null;
    if (existing && existing.href !== href) existing.remove();
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  }, [publicBranding]);

  const viewOptions = useMemo(() => options.map(toViewOption), [options]);
  const chosen =
    viewOptions.length === 0
      ? null
      : viewOptions.find((o) => o.is_popular) ?? viewOptions[0]!;
  const selection = useMemo(() => {
    const picks: Record<string, boolean> = {};
    for (const item of chosen?.items ?? []) {
      if (item.is_addon) picks[item.id] = item.default_included;
    }
    return picks;
  }, [chosen]);

  if (!publicBranding) return null;
  const branding = viewBranding(publicBranding);
  const cardStyle = {
    background: branding.pageBg,
    color: branding.textColor,
    fontFamily: branding.bodyFontFamily,
  };

  return (
    <div className={device === 'mobile' ? 'mx-auto w-[375px] max-w-full' : 'mx-auto max-w-xl'}>
      {viewOptions.length === 0 ? (
        <div
          className="overflow-hidden rounded-xl border border-border px-5 py-6 shadow-sm animate-fade-in"
          style={cardStyle}
        >
          <p className="py-8 text-center text-xs" style={{ color: branding.mutedColor }}>
            Add a package option to see the couple&apos;s page here.
          </p>
        </div>
      ) : (
        // Same block-tree render the couple receives, so a customised
        // banner / footer / Accept style previews exactly.
        <div
          key={device}
          className="overflow-hidden rounded-xl border border-border shadow-sm animate-fade-in"
          style={cardStyle}
        >
          <ProposalDocumentBody
            blocks={blocks}
            branding={publicBranding}
            title={title}
            coupleName={coupleName || 'Your couple'}
            proposalNumber={proposalNumber}
            notes={notes}
            expiresAt={expiresAt ?? null}
            options={viewOptions}
            state="active"
            chosenId={chosen?.id ?? null}
            selection={selection}
            renderAccept={({ style, view, publicBranding }) => (
              <StaticAcceptCta expiresAt={expiresAt ?? null} branding={view} publicBranding={publicBranding} style={style} />
            )}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Email preview ────────────────────────────────────────────── */

/** The cover email, rendered from the production template. */
function EmailPreview({
  proposalNumber,
  title,
  coupleName,
  coupleEmail,
  businessName,
  options,
  shareUrl,
  device,
}: ProposalPreviewPaneProps & { device: Device }) {
  const html = useMemo(
    () =>
      proposalHtml({
        coupleName: coupleName ?? 'there',
        proposalNumber,
        proposalTitle: title || `Proposal ${proposalNumber}`,
        shareUrl,
        mcBusinessName: businessName ?? 'Your MC',
        optionCount: options.length,
      }),
    [coupleName, proposalNumber, title, shareUrl, businessName, options.length],
  );

  return (
    <div
      className={`mx-auto overflow-hidden rounded-xl border border-border bg-card ${
        device === 'mobile' ? 'w-[320px]' : 'max-w-md'
      }`}
    >
      <div className="space-y-0.5 border-b border-border px-4 py-2.5 text-xs text-text-muted">
        <p>
          <span className="font-medium text-text">To:</span> {coupleEmail || 'couple@example.com'}
        </p>
        <p>
          <span className="font-medium text-text">Subject:</span> Proposal from{' '}
          {businessName ?? 'Your MC'} - {proposalNumber}
        </p>
      </div>
      <iframe title="Email preview" srcDoc={html} className="h-[480px] w-full border-0" />
    </div>
  );
}
