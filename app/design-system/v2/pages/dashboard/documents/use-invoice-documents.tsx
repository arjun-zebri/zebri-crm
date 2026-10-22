'use client';

import { useState } from 'react';

import { useAccount } from '../account';
import { openDesign, useCustomised } from '../canvas/docs/design-store';
import { DocumentModal, type OpenDoc } from '../payments/modal/document-modal';
import { usePaymentsState } from '../payments/use-payments-state';

import { invoiceTemplatesOf, usedLine } from './invoice-templates';
import type { TemplateRow } from './kind-section';

/**
 * Invoices, as one kind of document on the Documents page: a row per
 * invoice template, and New invoice in the same document modal Payments
 * uses. The money itself (what is owed, GST,
 * the export) stays on Payments; this is the paperwork. A new template,
 * or editing one, opens the MC's invoice: the words around it are
 * theirs, the number, lines and how to pay are filled in by Zebri.
 *
 * @module app/design-system/v2/pages/dashboard/documents/use-invoice-documents
 */

/** Invoices for the Documents page. */
export function useInvoiceDocuments() {
  const [open, setOpen] = useState<OpenDoc | null>(null);
  const [composing, setComposing] = useState(false);
  const account = useAccount();
  const state = usePaymentsState(account.invoices);
  const templates = invoiceTemplatesOf(account);
  const design = () => openDesign('invoice');
  const own = useCustomised('invoice');
  const rows: TemplateRow[] = templates.length
    ? templates.map((t) => ({ key: t.id, name: t.name, detail: t.use, note: usedLine(t.used), onOpen: design }))
    : // Before the first invoice there are no ways of billing yet, but an invoice they have made their own is set up all the same.
      own
      ? [{ key: 'invoice', name: 'Your invoice', detail: 'Your words and look, used for every invoice', note: 'Not sent yet', onOpen: design }]
      : [];
  return {
    rows,
    newDocument: () => setOpen({ kind: 'invoice', id: null }),
    newTemplate: design,
    dialogs: <DocumentModal doc={open} composing={composing} onCompose={setComposing} state={state} onClose={() => setOpen(null)} />,
  };
}
