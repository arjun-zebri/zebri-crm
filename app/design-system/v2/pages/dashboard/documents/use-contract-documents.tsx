'use client';

import { useState } from 'react';

import { useAccount } from '../account';
import { openDesign, useCustomised } from '../canvas/docs/design-store';
import { DocumentModal, type OpenDoc } from '../payments/modal/document-modal';
import { usePaymentsState } from '../payments/use-payments-state';

import type { TemplateRow } from './kind-section';

/**
 * Contracts, as one kind of document on the Documents page (they used
 * to be a tab on Payments): its Sent items, which open in the Payments
 * document modal as the couple sees them, and New contract. The MC's
 * contract is their own wording and look, edited in one place: Set up,
 * New, or the row opens it (`openDesign`), on Zebri's starting contract
 * until they have saved changes. New contract (sending one) needs an
 * accepted proposal, which a new MC has none of.
 *
 * @module app/design-system/v2/pages/dashboard/documents/use-contract-documents
 */

/** Contracts for the Documents page; `startNew` opens on a new contract. */
export function useContractDocuments({ startNew = false }: { startNew?: boolean | undefined }) {
  const [open, setOpen] = useState<OpenDoc | null>(startNew ? { kind: 'contract', id: null } : null);
  const [composing, setComposing] = useState(false);
  const account = useAccount();
  // The modal reads invoices too: a contract shows what its invoices owe.
  const state = usePaymentsState(account.invoices);
  // Theirs once they have edited it (Set up), or brought their own terms.
  const own = useCustomised('contract') || Boolean(account.terms);
  const sent = account.contracts.length;
  const rows: TemplateRow[] = own
    ? [
        {
          key: 'contract',
          name: 'Your contract',
          detail: 'Your wording, used for every client',
          note: sent ? `Sent to ${sent} ${sent === 1 ? 'client' : 'clients'}` : 'Not sent yet',
          onOpen: () => openDesign('contract'),
        },
      ]
    : [];
  return {
    rows,
    newDocument: () => setOpen({ kind: 'contract', id: null }),
    newTemplate: () => openDesign('contract'),
    dialogs: <DocumentModal doc={open} composing={composing} onCompose={setComposing} state={state} onClose={() => setOpen(null)} />,
  };
}
