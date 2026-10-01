'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
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
 * The proposal editor: where New proposal lands for an account that can
 * send. The couple's page fills the left, live, on the grey desk every
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
 * @module app/design-system/v2/pages/dashboard/proposals/editor/proposal-editor
 */

export interface ProposalEditorProps {
  /** Who it is for, and the template it starts from; closed while null. */
  target: { couple: string; wedding: Wedding; template: TemplateId } | null;
  onClose: () => void;
  onSend: (draft: ProposalDraft) => void;
}

const EMPTY: DemoPackage = { name: '', price: 0, lines: [] };

/** The editor. Keyed by the caller, so each opening starts from the account. See {@link ProposalEditorProps}. */
export function ProposalEditor({ target, onClose, onSend }: ProposalEditorProps) {
  const account = useAccount();
  const template = templateOf(target?.template ?? 'full-day');
  const [brand, setBrand] = useState<Brand>(account.brand ?? INITIAL.brand);
  const pkg = account.packages?.[0] ?? EMPTY;
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
    <Dialog open={target !== null} onClose={onClose} size="xl" aria-labelledby="editor-title">
      {target ? (
        <>
          <header className="flex flex-wrap items-start gap-x-6 gap-y-4 border-b border-zebra-950/5 px-5 pb-5 pt-6 md:px-8">
            <div className="min-w-0 flex-1 space-y-1">
              <h2 id="editor-title" className="type-title text-zebra-950">
                Proposal for {target.couple}
              </h2>
              <p className="type-body text-zebra-500">
                {template.name} · {target.wedding.date} · {target.wedding.venue}
              </p>
            </div>
            <div className="flex items-center gap-2 max-sm:order-last max-sm:w-full">
              <Button onClick={send} disabled={!ready}>
                Send to {first}
              </Button>
            </div>
            <div className="flex items-center sm:border-l sm:border-zebra-950/5 sm:pl-4">
              <Button variant="ghost" square aria-label="Close" onClick={onClose}>
                <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
              </Button>
            </div>
          </header>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:overflow-hidden">
            <div className="bg-zebra-50 p-5 md:p-8 lg:overflow-y-auto">
              <ProposalPreview
                template={template}
                wedding={target.wedding}
                className="mx-auto max-w-xl"
                packages={[{ ...pkg, name: pkg.name || 'Your package' }]}
                business={account.business}
                deposit={account.deposit}
                brand={brand}
                mc={account.mc}
                headline={template.headline}
                welcome={welcome}
              />
              <MoreBelow />
            </div>
            <div className="space-y-5 border-zebra-950/5 p-5 md:p-6 lg:overflow-y-auto lg:border-l">
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
