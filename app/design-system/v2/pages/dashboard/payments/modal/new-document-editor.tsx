'use client';

import { useRef, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { DialogHeader } from '@/components/ui-v2/dialog-parts';
import { ClientsIcon, ContractIcon, InvoiceIcon } from '@/components/ui-v2/icons';
import { MenuOption } from '@/components/ui-v2/popover';
import { PropertyChip } from '@/components/ui-v2/property-chip';

import { acceptedFor, useAccount, type Clause, type InvoiceDraft } from '../../account';
import { StyleScope, useDocumentStyle } from '../../brand/use-document-style';
import { DesignButton } from '../../canvas/docs/design-button';
import { isCustomised, layoutOf } from '../../canvas/docs/design-store';
import { clientName } from '../../clients/clients-data';
import { mcSigns } from '../../doc-builder/doc-types/contract/signing';
import type { DocLayout } from '../../doc-builder/model/types';
import { isTestClient } from '../../first-run/derive';
import { MoreBelow } from '../../proposals/editor/more-below';
import { isoFromDisplay } from '../dates';
import { money } from '../payments-data';

import { CLAUSES } from './contract-clauses';
import { ContractPreview } from './contract-preview';
import { ContractTerms } from './contract-terms';
import { draftContract, draftInvoice } from './drafts';
import { InvoiceEmail, noteFor } from './invoice-email';
import { BALANCE, InvoiceTerms } from './invoice-terms';

/**
 * New contract or New invoice, for an account that can send them: the
 * document modal's own layout on the v2 dialog anatomy (`DialogHeader`
 * with the quiet title and Close; the page on the grey desk, the working
 * column beside it; Send to Clara on the header row beside Close, the primary last), with the page being the real document as it will
 * go, redrawn as the side panel changes. Who it is for comes first when
 * there is a choice; both are made from that client's accepted proposal,
 * so only clients with one are offered.
 *
 * A contract's side is a line on what it is (Zebri's standard agreement,
 * not editable here; the MC brings their own in later) and, the first
 * time, the MC's signature; an invoice's is the deposit share, the due
 * date and what Zebri does for them, beside the deposit email as the couple gets it
 * (`InvoiceEmail`, in the MC's brand, not the paper tax invoice, which
 * goes with it as a PDF). Neither labels the page ("What Clara sees") nor
 * restates who it is for when there is only one client: the page says both.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/new-document-editor
 */

export type DocumentSend = { kind: 'contract'; clauses: Clause[]; layout?: DocLayout | undefined } | { kind: 'invoice'; draft: InvoiceDraft };

export interface NewDocumentEditorProps {
  kind: 'invoice' | 'contract';
  onSend: (clientId: string, what: DocumentSend) => void;
  onClose: () => void;
}

/** The editor. See {@link NewDocumentEditorProps}. */
export function NewDocumentEditor({ kind, onSend, onClose }: NewDocumentEditorProps) {
  const account = useAccount();
  const style = useDocumentStyle(kind);
  const ready = account.clients.flatMap((c) => {
    const a = acceptedFor(account, clientName(c));
    return a ? [{ client: c, ...a }] : [];
  });
  const [picked, setPicked] = useState<string | null>(ready[0]?.client.id ?? null);
  const [choosing, setChoosing] = useState(false);
  // The standard agreement: it is not edited in the send flow.
  const clauses: Clause[] = CLAUSES;
  // The note starts written, so the email is never bare; it greets whoever is picked first.
  const [draft, setDraft] = useState<InvoiceDraft>(() => ({
    percent: ready[0]?.percent ?? account.deposit,
    dueDays: 7,
    note: noteFor(ready[0]?.client.names.filter(Boolean).join(' and ') ?? ''),
  }));
  // Only a contract needs the MC's signature, and only until they have one.
  // The MC's own contract, once they have made it theirs: it says whether they sign too.
  const own = kind === 'contract' && isCustomised('contract') ? layoutOf('contract', account) : null;
  const theySign = mcSigns(own);
  const signing = kind === 'contract' && theySign && Boolean(account.saveSignature) && !account.signature;
  const [drawn, setDrawn] = useState<string | null>(null);
  const desk = useRef<HTMLDivElement>(null);
  // The signature line is on page two: bring it into view as the MC signs,
  // so they watch their own signature land on the contract.
  function sign(png: string | null) {
    setDrawn(png);
    if (!png) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    desk.current
      ?.querySelector('[aria-label="Signatures"]')
      ?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
  }
  const chosen = ready.find((r) => r.client.id === picked) ?? null;
  const what = kind === 'invoice' ? 'deposit invoice' : 'contract';

  const title = kind === 'invoice' ? 'New invoice' : 'New contract';
  const icon = kind === 'invoice' ? InvoiceIcon : ContractIcon;
  if (!chosen)
    return (
      <>
        <DialogHeader id="doc-title" icon={icon} title={title} onClose={onClose} />
        <div className="flex flex-1 items-center justify-center bg-zebra-50 p-8">
          <p className="max-w-sm text-center type-body text-zebra-500">
            Nobody has accepted a proposal yet. A {what} is made from an accepted one, so send a proposal first.
          </p>
        </div>
      </>
    );

  const first = chosen.client.names[0];
  const mc = account.mc?.name ?? account.business;
  function send() {
    if (!chosen || (signing && !drawn)) return;
    if (kind === 'contract') {
      if (signing && drawn) account.saveSignature?.(drawn);
      // The MC's own contract goes out as it is now, frozen into this one; until they have made it theirs, the classic page does.
      onSend(chosen.client.id, { kind, clauses, layout: own ?? undefined });
    } else onSend(chosen.client.id, { kind, draft });
  }

  const contract = draftContract(chosen.client, chosen.pkg, theySign ? mc : null, clauses, Boolean(account.signature || drawn));
  const invoice = draftInvoice(chosen.client, chosen.pkg, 1001 + account.invoices.length, draft.percent, draft.dueDays, draft.note);

  return (
    <>
    {/* The actions sit on the header row beside Close, as in First
        proposal (user, 2026-10-14: a send button alone in a footer strip
        read unlike the rest of the practice run). */}
    <DialogHeader
      id="doc-title"
      icon={icon}
      title={title}
      onClose={onClose}
      actions={
        <>
          {/* Not in the practice run: the first contract and invoice are about the booking, not the look (founder, 2026-10-08). */}
          {isTestClient(chosen.client.id) ? null : (
            <DesignButton kind={kind} label={`Edit your ${kind}`} data={kind === 'invoice' ? { invoice } : { contract, drawn: drawn ?? account.signature }} />
          )}
          <Button disabled={(signing && !drawn) || (kind === 'invoice' && draft.percent <= 0)} onClick={send}>
            Send to {first}
          </Button>
        </>
      }
    />
    <div className="shrink-0 space-y-1 px-6 pb-6 pt-2 sm:px-10">
      <p className="type-title text-zebra-950">
        {kind === 'invoice' ? 'Deposit invoice' : 'Contract'} for {clientName(chosen.client)}
      </p>
      <p className="type-body text-zebra-500">
        {[chosen.pkg.name, chosen.client.date, chosen.client.venue].filter(Boolean).join(' · ')}
      </p>
    </div>
    {/* The invoice's named rows fit a 24rem side, as the contract's room for the signature pad. */}
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:overflow-hidden ${kind === 'invoice' ? 'lg:grid-cols-[minmax(0,1fr)_24rem]' : 'lg:grid-cols-[minmax(0,1fr)_24rem]'}`}
    >
      <div ref={desk} className="space-y-3 bg-zebra-50 p-5 md:p-8 lg:overflow-y-auto">
        <StyleScope style={style}>
        {kind === 'contract' ? (
          <ContractPreview contract={contract} signature={drawn ?? account.signature} />
        ) : (
          <InvoiceEmail
            invoice={invoice}
            balance={{ span: draft.balance ?? BALANCE, eventOn: isoFromDisplay(chosen.client.date), from: draft.balanceFrom }}
          />
        )}
        </StyleScope>
        <MoreBelow />
      </div>
      <div className="flex flex-col gap-6 border-hairline p-5 md:p-8 lg:overflow-y-auto lg:border-l">
        {ready.length > 1 ? (
          // Who it is for: one pick, so a chip naming the client, as New client's details are.
          <div className="-mx-2.5">
            <PropertyChip icon={ClientsIcon} label="For" value={`For ${clientName(chosen.client)}`} open={choosing} onOpenChange={setChoosing} size="menu">
              {ready.map(({ client, pkg, percent }) => (
                <MenuOption
                  key={client.id}
                  selected={picked === client.id}
                  description={`${pkg.name} · ${money(pkg.price)}`}
                  onSelect={() => {
                    setPicked(client.id);
                    // Each client's deposit is the one their proposal promised.
                    setDraft((d) => ({ ...d, percent }));
                    setChoosing(false);
                  }}
                >
                  {clientName(client)}
                </MenuOption>
              ))}
            </PropertyChip>
          </div>
        ) : null}
        {kind === 'contract' ? (
          <ContractTerms signing={signing} onSignature={sign} />
        ) : (
          <InvoiceTerms draft={draft} onDraft={setDraft} price={chosen.pkg.price} eventOn={isoFromDisplay(chosen.client.date)} />
        )}
      </div>
    </div>
    </>
  );
}
