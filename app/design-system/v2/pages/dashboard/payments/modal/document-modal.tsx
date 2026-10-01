'use client';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';

import { useAccount } from '../../account';
import { coupleName } from '../payments-data';
import type { PaymentsState } from '../use-payments-state';

import { ContractPreview } from './contract-preview';
import { ContractFacts } from './document-facts';
import { DocumentHeader } from './document-header';
import { InvoicePreview } from './invoice-preview';
import { InvoiceProgress } from './invoice-progress';
import { InvoiceSide } from './invoice-side';
import { NewDocument } from './new-document';
import { NewDocumentEditor } from './new-document-editor';
import { ReminderDialog } from './reminder-dialog';

/**
 * An invoice or contract opened from the Payments page: an `xl` v2
 * dialog (full screen on phones). The header names the document and
 * holds its actions. Below, on a soft grey desk on the left: for an
 * invoice, where it has got to (Sent, Opened, Due, Reminded, Paid), then
 * the document as the couple sees it; on the right, the payment plan
 * and history (for a contract, its signers and history). Send reminder
 * opens Zebri's drafted reminder as a second dialog in front. New
 * invoice and New contract open here too, on an empty page that says
 * the builder is coming; for an account that can send them, the
 * editor (`new-document-editor.tsx`) instead.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/document-modal
 */

/** What is open: a document by id, or a new one (`id: null`). */
export type OpenDoc = { kind: 'invoice' | 'contract'; id: string | null };

export interface DocumentModalProps {
  doc: OpenDoc | null;
  /** Whether the reminder dialog is open. */
  composing: boolean;
  onCompose: (open: boolean) => void;
  state: PaymentsState;
  onClose: () => void;
}

/** The document dialog. See {@link DocumentModalProps}. */
export function DocumentModal({ doc, composing, onCompose, state, onClose }: DocumentModalProps) {
  const invoice = doc?.kind === 'invoice' ? state.invoices.find((i) => i.id === doc.id) : undefined;
  const account = useAccount();
  const contract = doc?.kind === 'contract' ? account.contracts.find((c) => c.id === doc.id) : undefined;
  const canSend = doc?.kind === 'contract' ? account.sendContract : account.sendInvoice;
  const found = invoice ?? contract;
  return (
    <>
      <Dialog open={doc !== null} onClose={onClose} size="xl" aria-labelledby="doc-title">
        {doc ? (
          <>
            {!found && canSend ? null : (
              <DocumentHeader
                invoice={invoice}
                contract={contract}
                kind={doc.kind}
                onRemind={() => onCompose(true)}
                onMarkPaid={() => invoice && state.markPaid(invoice.id)}
                onClose={onClose}
              />
            )}
            {!found && canSend ? (
              <NewDocumentEditor
                kind={doc.kind}
                onClose={onClose}
                onSend={(id, what) => {
                  if (what.kind === 'contract') account.sendContract?.(id, what.clauses);
                  else account.sendInvoice?.(id, what.draft);
                  onClose();
                }}
              />
            ) : (
            <div
              className={`flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:overflow-hidden ${found ? 'lg:grid-cols-[minmax(0,1fr)_24rem]' : ''}`}
            >
              <div className="space-y-6 bg-zebra-50 p-5 md:p-8 lg:overflow-y-auto">
                {invoice ? <InvoiceProgress invoice={invoice} reminded={state.reminded.has(invoice.id)} /> : null}
                {found ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="type-body text-zebra-500">What {coupleName(found.names)} see</p>
                      <Button variant="plain">Download PDF</Button>
                    </div>
                    {invoice ? <InvoicePreview invoice={invoice} /> : contract ? <ContractPreview contract={contract} /> : null}
                  </div>
                ) : (
                  <div className="mx-auto max-w-2xl">
                    <NewDocument kind={doc.kind} />
                  </div>
                )}
              </div>
              {found ? (
                <div className="border-zebra-950/5 p-5 md:p-8 lg:overflow-y-auto lg:border-l">
                  {invoice ? (
                    <InvoiceSide invoice={invoice} state={state} />
                  ) : contract ? (
                    <ContractFacts contract={contract} reminded={state.reminded.has(contract.id)} />
                  ) : null}
                </div>
              ) : null}
            </div>
            )}
          </>
        ) : null}
      </Dialog>
      {/* After the document's dialog, so it opens in front of it. */}
      {found ? (
        <ReminderDialog
          key={`${found.id}-${composing}`}
          doc={found}
          open={doc !== null && composing}
          sentHere={state.reminded.has(found.id)}
          onClose={() => onCompose(false)}
          onSent={() => {
            state.remind(found.id);
            onCompose(false);
          }}
        />
      ) : null}
    </>
  );
}
