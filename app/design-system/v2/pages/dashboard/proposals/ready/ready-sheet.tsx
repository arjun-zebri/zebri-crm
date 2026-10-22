'use client';

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { EditIcon, EyeIcon } from '@/components/ui-v2/icons';
import { plainText, resolvePackageOptions } from '@/features/proposals';

import { AccountContext, useAccount } from '../../account';
import { clientName } from '../../clients/clients-data';
import { blockerOf, freeze, packagesOn } from '../../doc-builder/doc-types/proposal/composed';
import { writeDraft } from '../../doc-builder/doc-types/proposal/drafts';
import { useTemplateChoices } from '../../doc-builder/doc-types/proposal/template-store';
import { CouplePage, leadPrice } from '../../doc-builder/render/couple-page';
import { useDocEditor } from '../../doc-builder/state/use-doc-editor';
import { isTestClient } from '../../first-run/derive';
import { EmailBuilder } from '../../journeys/email-builder';
import { InboxPreview, START_VIEW, type PreviewView } from '../../journeys/inbox-preview';
import type { StepEmail } from '../../journeys/step-settings';
import { TabMenu } from '../../journeys/tab-menu';
import { ContractPreview } from '../../payments/modal/contract-preview';
import { InvoicePreview } from '../../payments/modal/invoice-preview';
import { PreviewOverlay } from '../editor/preview-overlay';
import { useProposalStart, type ProposalTarget } from '../editor/use-proposal-start';

import { contractFor, invoiceFor, proposalEmail, textOf, type ReadyFor } from './ready-docs';
import { ReadyPanel, type ReadyPackage } from './ready-panel';
import { yesLines } from './when-yes';

/**
 * Ready to send: where a proposal opens, built like the journey step
 * dialog (xl, what the couple gets on the left, the settings on the
 * right). On the left, tabs for the proposal itself (written for this
 * couple, read-only, with Preview for the live page), the email that
 * carries it (Edit email opens the email builder), and each document
 * saying yes sends: the contract and the deposit and balance invoices,
 * drawn with this couple's package and price. On the right, the few
 * things that matter (see `ReadyPanel`), Send proposal, and Customise
 * the page for the whole editor, which keeps to the same draft.
 *
 * Replaced opening on the full editor (2026-10-08 review): a new MC's
 * first proposal dropped them into a page builder, and the contract and
 * invoices that saying yes sends were never shown before they went.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/ready/ready-sheet
 */

export interface ReadySheetProps {
  target: ProposalTarget;
  /** Opens the template picked, re-keying this sheet. */
  onTemplate: (key: string) => void;
  /** Opens the full editor on the same draft. */
  onCustomise: () => void;
  onSend: (message: string, page: ReturnType<typeof freeze>) => void;
  onClose: () => void;
}

/** The sheet. Keyed by the caller per couple and template. See {@link ReadySheetProps}. */
export function ReadySheet({ target, onTemplate, onCustomise, onSend, onClose }: ReadySheetProps) {
  const account = useAccount();
  const choices = useTemplateChoices();
  const start = useProposalStart(target);
  const builder = useDocEditor(start.initial, { who: start.who, terms: start.initialTerms, fill: start.fill, mode: 'proposal' });
  const { layout } = builder.state;
  const { terms } = builder;
  const { couple, wedding } = target;

  // Kept as it changes, to the same draft the editor reads; the page as it opened is not a change.
  const opened = useRef({ layout, terms });
  useEffect(() => {
    if (layout !== opened.current.layout || terms !== opened.current.terms) writeDraft(start.key, { layout, terms, at: Date.now() });
  }, [layout, terms, start.key]);

  const client = account.clients.find((c) => clientName(c) === couple);
  // The practice run's test send: just the proposal, who it goes to and the price. What saying yes sends is the
  // lesson that comes after (Zebri sends the contract by itself), so it is not laid out here first (founder, 2026-10-08).
  const practice = client ? isTestClient(client.id) : false;
  const names: [string, string] = client?.names ?? [couple.split(' & ')[0] ?? couple, couple.split(' & ')[1] ?? ''];
  const [to, setTo] = useState(client?.email || `${names[0].toLowerCase()}@example.com`);
  const options = packagesOn(layout);
  const packages: ReadyPackage[] = options.map((o) => ({ name: plainText(o.title), price: o.fixedPrice ?? 0 }));
  const price = leadPrice(layout);
  const lead = options.find((o) => o.isPopular) ?? options[0];
  const r: ReadyFor = { names, greet: wedding.greet, item: lead ? plainText(lead.title) : 'Package', total: price, event: wedding.date };
  const draftEmail = proposalEmail(r, account.business);
  const [email, setEmail] = useState<StepEmail>(draftEmail);
  const [drafting, setDrafting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [view, setView] = useState<PreviewView>(START_VIEW);
  const [picked, setPicked] = useState('proposal');

  const yes = yesLines(terms, price);
  const tabs = practice ? ['proposal'] : ['proposal', 'email', ...yes.map((l) => l.tab)];
  const labels: Record<string, string> = { proposal: 'Proposal', email: 'Email', contract: 'Contract', deposit: 'Deposit invoice', balance: 'Balance invoice' };
  const tab = tabs.includes(picked) ? picked : 'proposal';
  const deposit = Math.round((price * terms.deposit) / 100);

  const setPackage = (i: number, pkg: ReadyPackage) => {
    const section = layout.sections.find((s) => s.data?.kind === 'packages');
    if (section?.data?.kind !== 'packages') return;
    const data = section.data.packages;
    const next = resolvePackageOptions(data).map((o, j) => (j === i ? { ...o, title: pkg.name, fixedPrice: pkg.price } : o));
    builder.dispatch({ type: 'setData', id: section.id, data: { kind: 'packages', packages: { ...data, options: next } } }, { commit: true });
  };
  const customise = () => (writeDraft(start.key, { layout, terms, at: Date.now() }), onCustomise());

  return (
    <Dialog open onClose={onClose} size="xl" aria-labelledby="ready-title">
      <div className="flex min-h-0 flex-1">
        <section aria-label={`What ${couple} get`} className="relative hidden min-h-0 flex-1 flex-col border-r border-hairline bg-zebra-50 md:flex">
          <div className="flex items-center gap-2 px-5 py-3">
            {practice ? null : <TabMenu label={`What ${couple} get`} tabs={tabs} labels={labels} value={tab} onChange={setPicked} />}
            <span className="flex-1" />
            {tab === 'proposal' ? (
              <Button variant="secondary" icon={<EyeIcon aria-hidden="true" className="size-4" />} onClick={() => setPreviewing(true)}>
                Preview
              </Button>
            ) : null}
            {tab === 'email' ? (
              <Button variant="secondary" icon={<EditIcon aria-hidden="true" className="size-4" />} onClick={() => setDrafting(true)}>
                Edit email
              </Button>
            ) : null}
          </div>
          {/* A column, so a short page sits centred (my-auto) while a long one scrolls from its top. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-10 py-8">
            <div className="my-auto">
              {tab === 'proposal' ? (
                // zoom, not scale: the box shrinks too, so the canvas scrolls exactly as far as the page goes.
                <div aria-hidden="true" inert className="mx-auto w-[1000px] overflow-hidden rounded-check bg-field shadow-lg ring-1 ring-hairline [zoom:0.68]">
                  <CouplePage layout={{ ...layout, theme: builder.theme }} branding={builder.branding} doc={builder.doc} terms={terms} mode="page" placeholders />
                </div>
              ) : tab === 'email' ? (
                <InboxPreview email={email} when="When you send it" button="View your proposal" to={wedding.greet} view={view} onView={setView} />
              ) : (
                // No frame of its own: the contract and invoices draw on DocumentPage, which is the paper.
                <div aria-hidden="true" inert className="mx-auto w-[794px] [zoom:0.85]">
                  {/* The contract reads its deposit from the account; this proposal's deposit is the one it promises. */}
                  <AccountContext.Provider value={{ ...account, deposit: terms.deposit }}>
                    {tab === 'contract' ? <ContractPreview contract={contractFor(r, terms.balanceDays, account.terms)} /> : null}
                    {tab === 'deposit' ? <InvoicePreview invoice={invoiceFor(r, 'Deposit', deposit, 0, 7)} /> : null}
                    {tab === 'balance' ? <InvoicePreview invoice={invoiceFor(r, 'Final payment', price - deposit, deposit, terms.balanceDays)} /> : null}
                  </AccountContext.Provider>
                </div>
              )}
            </div>
          </div>
        </section>
        <ReadyPanel
          couple={couple}
          when={`${wedding.date} · ${wedding.venue}`}
          to={to}
          onTo={setTo}
          choices={choices}
          template={target.template}
          onTemplate={onTemplate}
          packages={packages}
          onPackage={setPackage}
          terms={terms}
          onTerms={builder.setTerms}
          price={price}
          practice={practice}
          showing={tab}
          onShow={setPicked}
          blocked={blockerOf(layout)?.message ?? null}
          onCustomise={customise}
          onSend={() => onSend(textOf(email), freeze(builder))}
          onClose={onClose}
        />
      </div>
      {drafting ? <EmailBuilder purpose="Proposal email" value={email} draft={draftEmail} button="View your proposal" onSave={(e) => setEmail(e ?? draftEmail)} onClose={() => setDrafting(false)} /> : null}
      <PreviewOverlay open={previewing} onClose={() => setPreviewing(false)} builder={builder} />
    </Dialog>
  );
}
