/**
 * Right-pane preview for the proposal composer.
 *
 * Two tabs while the proposal surface is being built out:
 * - **Page**: a faithful summary of what the couple sees on
 *   `/proposal/[token]` — the option cards with base items, add-on
 *   ticks seeded from the MC's pre-ticks, and per-option totals.
 *   (Swaps to the branded public-page renderer once the proposal
 *   branding surface lands.)
 * - **Email**: the cover email the couple receives, rendered from
 *   the real `proposalHtml` template.
 *
 * @module components/builders/parts/proposal-preview-pane
 */
'use client';

import { Check, Globe, Mail } from 'lucide-react';
import { useMemo, useState } from 'react';

import { proposalHtml } from '@/lib/email/html';
import { formatAUD } from '@/lib/payments/format';

import { optionBaseTotal, type ProposalOptionDraft } from './proposal-option-card';

export interface ProposalPreviewPaneProps {
  proposalNumber: string;
  title: string;
  coupleName: string | null;
  coupleEmail?: string | null;
  businessName: string | null;
  notes: string | null;
  options: ProposalOptionDraft[];
  shareUrl: string;
}

export function ProposalPreviewPane(props: ProposalPreviewPaneProps) {
  const [tab, setTab] = useState<'page' | 'email'>('page');

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
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
      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-muted p-4">
        {tab === 'page' ? <PagePreview {...props} /> : <EmailPreview {...props} />}
      </div>
    </div>
  );
}

/** What the couple sees: one card per option, add-ons pre-ticked. */
function PagePreview({ title, coupleName, notes, options }: ProposalPreviewPaneProps) {
  return (
    <div className="mx-auto max-w-md space-y-3">
      <div className="text-center">
        <p className="text-sm font-semibold text-text">{title || 'Wedding Proposal'}</p>
        <p className="text-xs text-text-muted">
          {coupleName ? `for ${coupleName}` : 'for your couple'}
          {options.length > 1 ? ' · they choose one option' : ''}
        </p>
      </div>
      {options.map((option, i) => {
        const preTicked = option.addOns.filter((a) => a.defaultIncluded);
        const total =
          optionBaseTotal(option) + preTicked.reduce((sum, a) => sum + Number(a.amount || 0), 0);
        return (
          <div key={option.key} className="rounded-xl border border-border bg-card p-3.5">
            <p className="text-sm font-semibold text-text">
              {option.title || `Option ${String(i + 1)}`}
            </p>
            {option.description && (
              <p className="mt-0.5 text-xs text-text-muted">{option.description}</p>
            )}
            <ul className="mt-2 space-y-1">
              {option.items.map((item) => (
                <li key={item.id} className="flex items-start gap-1.5 text-xs text-text">
                  <Check size={12} strokeWidth={1.5} className="mt-[2px] shrink-0 text-brand" />
                  <span className="min-w-0 flex-1 truncate">
                    {item.description || 'Untitled item'}
                  </span>
                </li>
              ))}
            </ul>
            {option.addOns.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-border pt-2">
                {option.addOns.map((addOn) => (
                  <li key={addOn.id} className="flex items-center gap-1.5 text-xs">
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                        addOn.defaultIncluded
                          ? 'border-text bg-text text-card'
                          : 'border-border bg-card'
                      }`}
                    >
                      {addOn.defaultIncluded && <Check size={10} strokeWidth={2} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-text-muted">
                      {addOn.description || 'Untitled add-on'}
                    </span>
                    <span className="shrink-0 tabular-nums text-text-muted">
                      +{formatAUD(Number(addOn.amount || 0))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2">
              <span className="text-xs text-text-muted">
                Total{option.gstInclusive ? ' (GST incl.)' : ' + GST'}
              </span>
              <span className="text-sm font-semibold tabular-nums text-text">
                {formatAUD(total)}
              </span>
            </div>
          </div>
        );
      })}
      {notes && <p className="whitespace-pre-wrap text-xs text-text-muted">{notes}</p>}
    </div>
  );
}

/** The cover email, rendered from the production template. */
function EmailPreview({
  proposalNumber,
  title,
  coupleName,
  coupleEmail,
  businessName,
  options,
  shareUrl,
}: ProposalPreviewPaneProps) {
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
    <div className="mx-auto max-w-md overflow-hidden rounded-xl border border-border bg-card">
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
