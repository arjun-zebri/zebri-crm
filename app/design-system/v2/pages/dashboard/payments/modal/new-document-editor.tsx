'use client';

import { useRef, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ChoiceCard } from '@/components/ui-v2/choice-card';

import { acceptedFor, useAccount, type Clause, type InvoiceDraft } from '../../account';
import { clientName } from '../../clients/clients-data';
import { MoreBelow } from '../../proposals/editor/more-below';
import { isoFromDisplay } from '../dates';
import { money } from '../payments-data';

import { CLAUSES } from './contract-clauses';
import { ContractPreview } from './contract-preview';
import { ContractTerms } from './contract-terms';
import { draftContract, draftInvoice } from './drafts';
import { EditorHeader } from './editor-header';
import { InvoiceEmail, noteFor } from './invoice-email';
import { BALANCE, InvoiceTerms } from './invoice-terms';

/**
 * New contract or New invoice, for an account that can send them: the
 * document modal's own layout (its own header, Send beside Close top
 * right as in the proposal editor; the page on the grey desk, the working
 * column beside it), with the page being the real document as it will
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

export type DocumentSend = { kind: 'contract'; clauses: Clause[] } | { kind: 'invoice'; draft: InvoiceDraft };

export interface NewDocumentEditorProps {
  kind: 'invoice' | 'contract';
  onSend: (clientId: string, what: DocumentSend) => void;
  onClose: () => void;
}

/** The editor. See {@link NewDocumentEditorProps}. */
export function NewDocumentEditor({ kind, onSend, onClose }: NewDocumentEditorProps) {
  const account = useAccount();
  const ready = account.clients.flatMap((c) => {
    const a = acceptedFor(account, clientName(c));
    return a ? [{ client: c, ...a }] : [];
  });
  const [picked, setPicked] = useState<string | null>(ready[0]?.client.id ?? null);
  // The standard agreement: it is not edited in the send flow.
  const clauses: Clause[] = CLAUSES;
  // The note starts written, so the email is never bare; it greets whoever is picked first.
  const [draft, setDraft] = useState<InvoiceDraft>(() => ({
    percent: account.deposit,
    dueDays: 7,
    note: noteFor(ready[0]?.client.names.filter(Boolean).join(' and ') ?? ''),
  }));
  // Only a contract needs the MC's signature, and only until they have one.
  const signing = kind === 'contract' && Boolean(account.saveSignature) && !account.signature;
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
  if (!chosen)
    return (
      <>
        <EditorHeader title={title} onClose={onClose} />
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
      onSend(chosen.client.id, { kind, clauses });
    } else onSend(chosen.client.id, { kind, draft });
  }

  return (
    <>
    <EditorHeader
      title={title}
      onClose={onClose}
      action={
        <Button disabled={(signing && !drawn) || (kind === 'invoice' && draft.percent <= 0)} onClick={send}>
          Send to {first}
        </Button>
      }
    />
    {/* The invoice's three fields need only the proposal editor's narrow side; the contract keeps room for the signature pad. */}
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:overflow-hidden ${kind === 'invoice' ? 'lg:grid-cols-[minmax(0,1fr)_17rem]' : 'lg:grid-cols-[minmax(0,1fr)_24rem]'}`}
    >
      <div ref={desk} className="space-y-3 bg-zebra-50 p-5 md:p-8 lg:overflow-y-auto">
        {kind === 'contract' ? (
          <ContractPreview
            contract={draftContract(chosen.client, chosen.pkg, mc, clauses, Boolean(account.signature || drawn))}
            signature={drawn ?? account.signature}
          />
        ) : (
          <InvoiceEmail
            invoice={draftInvoice(chosen.client, chosen.pkg, 1001 + account.invoices.length, draft.percent, draft.dueDays, draft.note)}
            balance={{ span: draft.balance ?? BALANCE, eventOn: isoFromDisplay(chosen.client.date) }}
          />
        )}
        <MoreBelow />
      </div>
      <div className="flex flex-col gap-6 border-zebra-950/5 p-5 md:p-8 lg:overflow-y-auto lg:border-l">
        {ready.length > 1 ? (
          <fieldset className="space-y-2">
            <legend className="pb-1 type-label text-zebra-950">For</legend>
            {ready.map(({ client, pkg }) => (
              <ChoiceCard key={client.id} selected={picked === client.id} onClick={() => setPicked(client.id)} className="py-3">
                <span className="type-label">{clientName(client)}</span>
                <span className="type-body text-zebra-500">
                  {pkg.name} · {money(pkg.price)}
                </span>
              </ChoiceCard>
            ))}
          </fieldset>
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
