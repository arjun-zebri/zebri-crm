'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { DateField, formatDate } from '@/components/ui-v2/date-field';
import { Dialog } from '@/components/ui-v2/dialog';
import { Input } from '@/components/ui-v2/input';
import { Segmented } from '@/components/ui-v2/segmented';
import { Select } from '@/components/ui-v2/select';

import { PACKAGES } from '../proposals/templates-data';

import {
  DialogBody,
  DialogFooter,
  DialogHeader,
  DoneView,
  EmailStep,
  useSend,
} from './dialog-parts';
import { AMOUNT, KINDS, PAYERS, PRICE, dollars, draft, inDays, type Kind } from './invoice-draft';

/**
 * Send an invoice, from Home's quick starts: an `md` dialog (one height
 * throughout) in two steps. First who and what: the client (anyone with
 * an accepted or sent proposal), what the invoice is for, the amount
 * (filled from their package, editable) and when it is due. Then the
 * email Zebri has written to carry it, with the pay link. Send lands on
 * a done view with a way through to Payments.
 * Keyed by the caller, so each opening starts fresh.
 *
 * @module app/design-system/v2/pages/dashboard/home/send-invoice-dialog
 */

export interface SendInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  /** Leaves Home for the Payments page. */
  onViewAll: () => void;
}

/** The Send an invoice dialog. See {@link SendInvoiceDialogProps}. */
export function SendInvoiceDialog({ open, onClose, onViewAll }: SendInvoiceDialogProps) {
  const [step, setStep] = useState<'details' | 'message' | 'sent'>('details');
  const [who, setWho] = useState(PAYERS[0] ?? '');
  const [kind, setKind] = useState<Kind>('Deposit');
  const [amount, setAmount] = useState(String(AMOUNT.Deposit));
  const [due, setDue] = useState(() => inDays(7));
  const [mail, setMail] = useState({ subject: '', body: '' });
  const { busy, send } = useSend();
  const value = Number(amount.replace(/[$,\s]/g, ''));
  const valid = Number.isFinite(value) && value > 0 && due !== '';
  return (
    <Dialog open={open} onClose={onClose} size="md" aria-labelledby="send-invoice-title">
      <DialogHeader
        id="send-invoice-title"
        title="Send an invoice"
        note={step === 'sent' ? undefined : `Step ${step === 'details' ? 1 : 2} of 2`}
      />
      {step === 'sent' ? (
        <DoneView
          title={`${dollars(value)} invoice sent to ${who}`}
          detail={`Due ${formatDate(due)}. Zebri will remind them a few days before, and tell you the moment it's paid.`}
        />
      ) : (
        <DialogBody>
          {step === 'details' ? (
            <div className="space-y-4">
              <Select
                label="Client"
                options={PAYERS}
                value={who}
                onChange={(e) => setWho(e.target.value)}
              />
              <div className="space-y-1.5">
                <p className="type-label text-zebra-950">For</p>
                <Segmented
                  label="For"
                  options={KINDS}
                  value={kind}
                  onChange={(k) => {
                    setKind(k);
                    setAmount(String(AMOUNT[k]));
                  }}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Amount"
                  inputMode="decimal"
                  leading={<span className="type-body">$</span>}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  error={amount.trim() && !(value > 0) ? 'Enter an amount, like 900' : undefined}
                />
                <DateField label="Due" value={due} onChange={setDue} />
              </div>
              <p className="type-body text-zebra-500">
                {PACKAGES.classic.name} · {dollars(PRICE)}
              </p>
            </div>
          ) : (
            <EmailStep
              intro={`${kind}, ${dollars(value)} for ${who}, with this email`}
              mail={mail}
              onChange={setMail}
              disabled={busy}
            />
          )}
        </DialogBody>
      )}
      <DialogFooter>
        {step === 'details' ? (
          <>
            <Button variant="plain" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!valid}
              onClick={() => {
                setMail(draft(who, kind, value, due));
                setStep('message');
              }}
            >
              Next
            </Button>
          </>
        ) : step === 'message' ? (
          <>
            <Button variant="plain" onClick={() => setStep('details')} disabled={busy}>
              Back
            </Button>
            <Button
              loading={busy}
              disabled={!mail.subject.trim() || !mail.body.trim()}
              onClick={() => send(() => setStep('sent'))}
            >
              Send invoice
            </Button>
          </>
        ) : (
          <>
            <Button variant="plain" onClick={onViewAll}>
              Open Payments
            </Button>
            <Button onClick={onClose}>Done</Button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}
