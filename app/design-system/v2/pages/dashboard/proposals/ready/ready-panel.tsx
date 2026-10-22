'use client';

import { Button } from '@/components/ui-v2/button';
import { DIALOG_FOOTER_PAD, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { ProposalIcon } from '@/components/ui-v2/icons';
import { InlineInput } from '@/components/ui-v2/inline-input';

import type { TemplateChoice } from '../../doc-builder/doc-types/proposal/template-store';
import type { BookingTerms } from '../../doc-builder/state/use-doc-editor';
import { StepChoice } from '../../journeys/step-choice';
import { StepRow } from '../../journeys/step-row';
import { money } from '../../payments/payments-data';

import { WhenYes, type YesTab } from './when-yes';

/**
 * Ready to send's right side: who it goes to, and the few things a
 * proposal turns on, as the journey step panel lays them out (a name
 * on the left, the value on the right): the template, each package's
 * name and price typed in place, the deposit, when the balance is due,
 * and whether there is a contract. Then what saying yes sends, each
 * line opening its document on the left. At the foot, the one way on:
 * Send proposal, with Customise the page beside it for the whole
 * editor. What stops it going (a package with no price) says so above
 * the buttons. The header is the v2 `DialogHeader`; sections are
 * separated by space, not rules.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/ready/ready-panel
 */

/** One package as the panel edits it. */
export interface ReadyPackage {
  name: string;
  price: number;
}

export interface ReadyPanelProps {
  couple: string;
  /** "Fri 26 Mar 2027 · The Boathouse, Sydney". */
  when: string;
  to: string;
  onTo: (to: string) => void;
  choices: TemplateChoice[];
  template: string;
  onTemplate: (key: string) => void;
  packages: ReadyPackage[];
  onPackage: (index: number, pkg: ReadyPackage) => void;
  terms: BookingTerms;
  onTerms: (terms: BookingTerms) => void;
  /** The package most couples pick, for the money on the yes lines. */
  price: number;
  /** The practice run's test send: only who it goes to and the package; the template, terms and what saying yes sends stay out. */
  practice?: boolean | undefined;
  /** The document showing on the left. */
  showing: string;
  onShow: (tab: YesTab) => void;
  /** Why it cannot go yet, or null. */
  blocked: string | null;
  onCustomise: () => void;
  onSend: () => void;
  onClose: () => void;
}

const DEPOSITS = [0, 25, 50, 100] as const;
const BALANCES = [14, 30, 60] as const;
const BALANCE_WORDS: Record<number, string> = {
  14: 'Two weeks before',
  30: 'A month before',
  60: 'Two months before',
};

/** Whole dollars only. */
const whole = (text: string) => Number(text.replace(/[^\d]/g, '')) || 0;

/** The panel. See {@link ReadyPanelProps}. */
export function ReadyPanel(p: ReadyPanelProps) {
  const { terms } = p;
  const depositWords = (d: number) =>
    d === 0
      ? 'Nothing up front'
      : d === 100
        ? 'Full amount'
        : `${d}%${p.price ? `, ${money(Math.round((p.price * d) / 100))}` : ''}`;
  const ok = !p.blocked && /\S+@\S+\.\S+/.test(p.to.trim());
  return (
    <section className="flex min-h-0 w-full flex-col md:w-96 md:shrink-0">
      {/* A narrow column of an xl dialog, so it takes the small dialog's padding. */}
      <DialogHeader id="ready-label" icon={ProposalIcon} title="Proposal · Not sent yet" size="sm" onClose={p.onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-6">
        <h2 id="ready-title" className="type-heading text-zebra-950">
          {p.couple}
        </h2>
        <p className="type-body text-zebra-500">{p.when}</p>
        <dl className="mt-4 space-y-1 type-body">
          <StepRow label="To">
            <InlineInput
              aria-label="To"
              type="email"
              placeholder="Their email"
              value={p.to}
              onChange={(e) => p.onTo(e.target.value)}
              className="min-w-0 flex-1 text-right"
            />
          </StepRow>
          {p.practice ? null : (
            <StepRow label="Template">
              <StepChoice
                label="Template"
                value={p.template}
                options={p.choices.map((c) => c.key)}
                labelOf={(k) => p.choices.find((c) => c.key === k)?.template.name ?? k}
                onChange={p.onTemplate}
              />
            </StepRow>
          )}
          {p.packages.map((pkg, i) => (
            <StepRow key={i} label={i ? '' : p.packages.length > 1 ? 'Packages' : 'Package'}>
              <InlineInput
                aria-label={`Package ${i + 1} name`}
                placeholder="Name it"
                value={pkg.name}
                onChange={(e) => p.onPackage(i, { ...pkg, name: e.target.value })}
                className="min-w-0 flex-1"
              />
              <span className="flex w-20 shrink-0 items-center justify-end gap-0.5 text-zebra-950">
                <span className="text-zebra-400">$</span>
                <InlineInput
                  aria-label={`Package ${i + 1} price`}
                  inputMode="numeric"
                  placeholder="Price"
                  value={pkg.price ? String(pkg.price) : ''}
                  onChange={(e) => p.onPackage(i, { ...pkg, price: whole(e.target.value) })}
                  className="w-16 text-right tabular-nums"
                />
              </span>
            </StepRow>
          ))}
          {p.practice ? null : (
            <>
              <StepRow label="Deposit">
                <StepChoice
                  label="Deposit"
                  value={terms.deposit}
                  options={DEPOSITS}
                  labelOf={depositWords}
                  onChange={(deposit) => p.onTerms({ ...terms, deposit })}
                />
              </StepRow>
              {terms.deposit < 100 ? (
                <StepRow label="Balance due">
                  <StepChoice
                    label="Balance due"
                    value={terms.balanceDays}
                    options={BALANCES}
                    labelOf={(d) => BALANCE_WORDS[d] ?? `${d} days before`}
                    onChange={(balanceDays) => p.onTerms({ ...terms, balanceDays })}
                  />
                </StepRow>
              ) : null}
              <StepRow label="Contract">
                <StepChoice
                  label="Contract"
                  value={terms.contract ? 'yes' : 'no'}
                  options={['yes', 'no'] as const}
                  labelOf={(v) => (v === 'yes' ? 'Your agreement' : 'No contract')}
                  onChange={(v) => p.onTerms({ ...terms, contract: v === 'yes' })}
                />
              </StepRow>
            </>
          )}
        </dl>
        {p.practice ? null : (
          <div className="mt-8 type-body">
            <WhenYes terms={terms} price={p.price} showing={p.showing} onShow={p.onShow} />
          </div>
        )}
      </div>
      {/* No rule: the foot is a row on the white, as every v2 dialog's is. */}
      <footer className={`space-y-3 pt-4 ${DIALOG_FOOTER_PAD}`}>
        {p.blocked ? (
          <p role="alert" className="type-body text-danger">
            {p.blocked}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <Button variant="plain" onClick={p.onCustomise}>
            Customise the page
          </Button>
          <Button disabled={!ok} onClick={p.onSend}>
            Send proposal
          </Button>
        </div>
      </footer>
    </section>
  );
}
