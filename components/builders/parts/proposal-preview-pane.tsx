/**
 * Right-pane preview for the proposal composer.
 *
 * Two tabs plus a device toggle (same segmented control as the email
 * template editor):
 * - **Page**: a faithful miniature of `/proposal/[token]` — the same
 *   card structure the couple sees: header (business, title, couple,
 *   number + expiry), the MC's notes as an intro, then each option
 *   with priced inclusions, add-on ticks seeded from the pre-ticks,
 *   and a live total. Mobile renders inside a phone frame.
 * - **Email**: the cover email the couple receives, rendered from
 *   the real `proposalHtml` template.
 *
 * @module components/builders/parts/proposal-preview-pane
 */
'use client';

import { Check, Globe, Mail, Monitor, Smartphone } from 'lucide-react';
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
  expiresAt?: string | null;
  options: ProposalOptionDraft[];
  shareUrl: string;
}

type Device = 'desktop' | 'mobile';

function formatExpiry(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

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

/** Eyebrow label, matching the public page's section treatment. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">{children}</p>
  );
}

/**
 * A miniature of the public page: the same open editorial layout the
 * couple scrolls through — eyebrow + names header, the MC's note,
 * the package with priced inclusions, add-on cards, the summary
 * panel and the accept CTA. Mobile wraps it in a phone frame so the
 * narrow reflow reads as intentional.
 */
function PagePreview({
  proposalNumber,
  coupleName,
  notes,
  expiresAt,
  options,
  device,
}: ProposalPreviewPaneProps & { device: Device }) {
  const single = options.length === 1;
  const page = (
    <div
      key={device}
      className="space-y-5 overflow-hidden rounded-xl border border-border bg-card px-5 py-5 shadow-sm animate-fade-in"
    >
      {/* Header — eyebrow + the couple's names. (No business line
          here: the composer context already makes the sender obvious.) */}
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <Eyebrow>Wedding proposal</Eyebrow>
          {expiresAt ? (
            <p className="shrink-0 text-[10px] text-text-subtle">
              Expires {formatExpiry(expiresAt)}
            </p>
          ) : null}
        </div>
        <p className="mt-2 text-xl font-semibold leading-snug text-text">
          {coupleName || 'Your couple'}
        </p>
      </div>

      {notes ? (
        <div>
          <Eyebrow>A note from us</Eyebrow>
          <p className="mt-1.5 whitespace-pre-wrap text-sm italic leading-relaxed text-text">
            {notes}
          </p>
        </div>
      ) : null}

      {options.length > 1 ? (
        <p className="text-[10px] text-text-subtle">
          The couple picks one of these {options.length} packages:
        </p>
      ) : null}

      {options.length === 0 ? (
        <p className="py-6 text-center text-xs text-text-subtle">
          Add a package option to see it here.
        </p>
      ) : (
        options.map((option, i) => (
          <OptionPreview key={option.key} option={option} index={i} single={single} />
        ))
      )}

      {options.length > 0 ? (
        <div>
          {/* CTA — visual only; the couple taps this on the real page. */}
          <div className="rounded-xl bg-brand-fg py-2.5 text-center text-xs font-medium text-text-inverse">
            Accept &amp; reserve our date
          </div>
          {expiresAt ? (
            <p className="mt-1.5 text-center text-[10px] text-text-subtle">
              This proposal is held for you until {formatExpiry(expiresAt)}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="text-center text-[9px] text-text-subtle">{proposalNumber}</p>
    </div>
  );

  // Mobile renders at true phone width (375px, like the email
  // template preview) — full size, no miniature bezel.
  if (device === 'mobile') {
    return <div className="mx-auto w-[375px] max-w-full">{page}</div>;
  }
  return <div className="mx-auto max-w-md">{page}</div>;
}

/** One option: priced inclusions, add-on cards, summary panel. */
function OptionPreview({
  option,
  index,
  single,
}: {
  option: ProposalOptionDraft;
  index: number;
  single: boolean;
}) {
  const preTicked = option.addOns.filter((a) => a.defaultIncluded);
  const baseTotal = optionBaseTotal(option);
  const total = baseTotal + preTicked.reduce((sum, a) => sum + Number(a.amount || 0), 0);

  return (
    <div className={!single && index > 0 ? 'border-t border-border pt-4' : ''}>
      {/* The package title alone carries a single-option preview; an
          eyebrow is only needed to number multi-option stacks. */}
      {!single && <Eyebrow>Option {index + 1}</Eyebrow>}
      <p className="mt-1 min-w-0 truncate text-base font-semibold text-text">
        {option.title || `Option ${String(index + 1)}`}
      </p>
      {option.description && (
        <p className="mt-0.5 text-xs text-text-muted">{option.description}</p>
      )}

      {/* Priced inclusions — same row shape as the public page. */}
      <ul className="mt-2">
        {option.items.map((item) => (
          <li
            key={item.id}
            className="flex items-baseline justify-between gap-3 border-b border-border/50 py-2 text-xs"
          >
            <span className="flex min-w-0 items-start gap-1.5 text-text">
              <Check size={12} strokeWidth={2} className="mt-[2px] shrink-0 text-brand" />
              <span className="min-w-0 truncate">{item.description || 'Untitled item'}</span>
            </span>
            <span className="shrink-0 tabular-nums text-text-muted">
              {formatAUD(Number(item.amount || 0))}
            </span>
          </li>
        ))}
      </ul>

      {option.addOns.length > 0 && (
        <div className="mt-3.5">
          <Eyebrow>Add to your day</Eyebrow>
          <p className="mt-0.5 text-[10px] text-text-subtle">
            Tap to include. The total updates instantly.
          </p>
          <ul className="mt-2 space-y-1.5">
            {option.addOns.map((addOn) => (
              <li
                key={addOn.id}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs ${
                  addOn.defaultIncluded ? 'border-border-strong' : 'border-border'
                }`}
              >
                <span
                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                    addOn.defaultIncluded
                      ? 'border-text bg-text text-card'
                      : 'border-border bg-card'
                  }`}
                >
                  {addOn.defaultIncluded && <Check size={10} strokeWidth={2} />}
                </span>
                <span className="min-w-0 flex-1 truncate text-text">
                  {addOn.description || 'Untitled add-on'}
                </span>
                <span className="shrink-0 tabular-nums text-text-muted">
                  +{formatAUD(Number(addOn.amount || 0))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary panel — base + pre-ticked add-ons, live total. */}
      <div className="mt-3.5 rounded-xl bg-surface-muted p-3.5">
        <div className="flex items-baseline justify-between gap-3 text-xs text-text">
          <span className="min-w-0 truncate">{option.title || `Option ${String(index + 1)}`}</span>
          <span className="shrink-0 tabular-nums">{formatAUD(baseTotal)}</span>
        </div>
        {preTicked.map((addOn) => (
          <div
            key={addOn.id}
            className="mt-1 flex items-baseline justify-between gap-3 text-xs text-text-muted"
          >
            <span className="min-w-0 truncate">{addOn.description || 'Untitled add-on'}</span>
            <span className="shrink-0 tabular-nums">+{formatAUD(Number(addOn.amount || 0))}</span>
          </div>
        ))}
        <div className="mt-2.5 flex items-baseline justify-between gap-3 border-t border-border pt-2">
          <span className="text-xs font-semibold text-text">
            Total{' '}
            <span className="font-normal text-text-muted">
              {option.gstInclusive ? 'GST incl.' : '+ GST'}
            </span>
          </span>
          <span className="text-lg font-semibold tabular-nums text-text">{formatAUD(total)}</span>
        </div>
        {option.depositPercent ? (
          <p className="mt-1 text-[10px] text-text-subtle">
            {formatAUD((total * Number(option.depositPercent)) / 100)} deposit reserves the date
          </p>
        ) : null}
      </div>
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
