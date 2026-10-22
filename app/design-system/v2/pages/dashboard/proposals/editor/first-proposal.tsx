'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogHeader } from '@/components/ui-v2/dialog-parts';
import { ProposalIcon } from '@/components/ui-v2/icons';
import { ensureBrandFontsStylesheet } from '@/lib/branding/fonts';

import type { Wedding } from '../../../onboarding/brand-doc-parts';
import { welcomeFor } from '../../../onboarding/brand-proposal';
import type { DemoPackage } from '../../../onboarding/packages';
import { INITIAL, type Brand } from '../../../onboarding/use-onboarding-state';
import { useAccount, type ProposalDraft } from '../../account';
import { ProposalPreview } from '../proposal-preview';
import { templateOf, type TemplateId } from '../templates-data';

import { BrandPanel } from './brand-panel';
import { MoreBelow } from './more-below';

/**
 * The first proposal: where the practice run's Send proposal lands,
 * restored from the 2026-10-01 preview (founder, 2026-10-08: "why did we
 * move away from this?"). Ready to send and the page builder replaced it
 * for every proposal; this one keeps the original page and Make it yours
 * for the test client, so a new MC's first proposal is the finished
 * template in their brand. The couple's page fills the left, live, on the grey desk every
 * document modal uses, with a soft glow at its foot (`MoreBelow`) so the
 * MC knows the page carries on below. The narrow right side is the brand
 * only, under one line saying the words, layout and packages are changed
 * in the proposal builder: this is the template with their brand on it,
 * not a builder, and saying so stops the MC hunting for controls that
 * are not here. (A Words and a Package tab were tried and taken out;
 * `words-panel.tsx` and `package-panel.tsx` are parked, unused.)
 *
 * The package sent is the account's first (a new account's starter), and
 * the words are the template's. Send saves the brand to the account, so
 * the contract, the invoice and the next proposal wear it, then sends.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/editor/first-proposal
 */

export interface FirstProposalProps {
  /** Who it is for, and the template it starts from; closed while null. */
  target: { couple: string; wedding: Wedding; template: TemplateId } | null;
  onClose: () => void;
  onSend: (draft: ProposalDraft) => void;
}

const EMPTY: DemoPackage = { name: '', price: 0, lines: [] };

/** The dialog. Keyed by the caller, so each opening starts from the account. See {@link FirstProposalProps}. */
export function FirstProposal({ target, onClose, onSend }: FirstProposalProps) {
  const account = useAccount();
  const template = templateOf(target?.template ?? 'full-day');
  const [brand, setBrand] = useState<Brand>(account.brand ?? INITIAL.brand);
  const pkg = account.packages?.[0] ?? EMPTY;
  // Up to two, as the original page offered: a choice reads as a real proposal (founder, 2026-10-08).
  const offered = (account.packages?.length ? account.packages : [EMPTY]).slice(0, 2).map((p) => ({ ...p, name: p.name || 'Your package' }));
  const welcome = welcomeFor(target?.wedding.greet ?? '');
  // Every catalogue font, once, so the preview can show any pick at once.
  useEffect(() => ensureBrandFontsStylesheet(), []);
  const first = target?.couple.split(' & ')[0] ?? '';
  const ready = pkg.name.trim() !== '' && pkg.price > 0;

  function send() {
    if (!target || !ready) return;
    const offer = { ...pkg, name: pkg.name.trim() };
    account.saveBrand?.(brand);
    onSend({ template: target.template, offer, headline: template.headline, welcome });
  }

  return (
    <Dialog open={target !== null} onClose={onClose} size="xl" aria-labelledby="editor-title editor-couple">
      {target ? (
        <>
          {/* The one action sits on the header row beside Close, never on a
              row of its own under it (user, 2026-10-14: a button stacked
              under the X read as clutter). */}
          <DialogHeader
            id="editor-title"
            icon={ProposalIcon}
            title="First proposal"
            actions={
              <Button onClick={send} disabled={!ready}>
                Send to {first}
              </Button>
            }
          />
          <div className="shrink-0 space-y-1 px-6 pb-6 pt-2 sm:px-10">
            <p id="editor-couple" className="type-title text-zebra-950">
              Proposal for {target.couple}
            </p>
            <p className="type-body text-zebra-500">
              {template.name} · {target.wedding.date} · {target.wedding.venue}
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:overflow-hidden">
            <div className="bg-zebra-50 p-5 md:p-8 lg:overflow-y-auto">
              <ProposalPreview
                template={template}
                wedding={target.wedding}
                className="mx-auto max-w-xl"
                packages={offered}
                business={account.business}
                deposit={account.deposit}
                brand={brand}
                mc={account.mc}
                headline={template.headline}
                welcome={welcome}
              />
              <MoreBelow />
            </div>
            <div className="space-y-5 border-hairline p-5 md:p-6 lg:overflow-y-auto lg:border-l">
              <div className="space-y-1">
                <h3 className="type-subheading text-zebra-950">Make it yours</h3>
                <p className="type-body text-zebra-500">
                  Start with your look. Later in the proposal builder, you design every section: photos, videos, words
                  and packages.
                </p>
              </div>
              <BrandPanel brand={brand} onBrand={(patch) => setBrand((b) => ({ ...b, ...patch }))} />
            </div>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}
