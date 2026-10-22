'use client';

import { useState } from 'react';

import { useAccount } from '../account';
import { NewClientDialog } from '../clients/new-client-dialog';
import { useProposalDocuments } from '../documents/use-proposal-documents';
import { DocumentModal } from '../payments/modal/document-modal';
import { usePaymentsState } from '../payments/use-payments-state';

import type { PageStep } from './tour';

/**
 * A first-run step's New dialog, opened over Home: New client, New
 * proposal, the contract or the deposit invoice. The guide used to open
 * each on its own page (Clients, Documents, Payments), so the sidebar
 * jumped tabs at every step; the MC is walking Home's to-dos, so Home
 * stays put (user, 2026-10-15). The dialogs are the real ones, run on the
 * new account. Rendered with a new `key` per step, so each opens fresh;
 * closed, it renders nothing until the next. `who` is the client the
 * guide is following, as the old page route passed it.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/step-dialogs
 */
export function StepDialog({ step, who }: { step: PageStep; who?: string | undefined }) {
  if (step === 'client') return <ClientStep />;
  if (step === 'proposal') return <ProposalStep who={who} />;
  return <DocumentStep kind={step} />;
}

function ClientStep() {
  const account = useAccount();
  const [open, setOpen] = useState(true);
  return (
    <NewClientDialog
      open={open}
      onClose={() => setOpen(false)}
      onAdd={(c) => {
        account.addClient?.(c);
        setOpen(false);
      }}
    />
  );
}

/** The guide's client named skips Who it's for and opens Ready to send for them (the test couple, in the practice run). */
function ProposalStep({ who }: { who?: string | undefined }) {
  return useProposalDocuments({ startNew: who ?? true }).dialogs;
}

function DocumentStep({ kind }: { kind: 'contract' | 'invoice' }) {
  const account = useAccount();
  const state = usePaymentsState(account.invoices);
  const [open, setOpen] = useState(true);
  const [composing, setComposing] = useState(false);
  return <DocumentModal doc={open ? { kind, id: null } : null} composing={composing} onCompose={setComposing} state={state} onClose={() => setOpen(false)} />;
}
