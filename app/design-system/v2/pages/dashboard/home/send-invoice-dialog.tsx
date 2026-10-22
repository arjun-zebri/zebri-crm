'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { formatDate } from '@/components/ui-v2/date-field';
import { Dialog } from '@/components/ui-v2/dialog';
import {
  DialogBody,
  DialogFooter,
  DialogHeader,
  DoneView,
  EmailStep,
  useSend,
} from '@/components/ui-v2/dialog-parts';
import { CalendarIcon, ClientsIcon, InvoiceIcon, PaymentsIcon, ReceiptIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { MenuOption } from '@/components/ui-v2/popover';
import { PropertyChip } from '@/components/ui-v2/property-chip';
import { RangeCalendar } from '@/components/ui-v2/range-calendar';

import { dayMonth, daysBetween } from '../payments/dates';
import { money } from '../payments/payments-data';
import { PACKAGES } from '../proposals/templates-data';

import { AMOUNT, KINDS, PAYERS, PRICE, draft, inDays, type Kind } from './invoice-draft';

/**
 * Send an invoice, from Home's quick starts: an `md` dialog (one height
 * throughout) in two steps. First who and what, built like New client:
 * the amount as the one field (an option G line led by the payments
 * icon, its name the grey placeholder), and the client (anyone with an accepted or sent
 * proposal), what it is for and when it is due as `PropertyChip`s that
 * say their value ("For Deposit", "Due 14 Mar · in 7 days"). A form, so
 * no Cancel on the first step: Escape, the scrim and Close leave. Then the
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
  const [chip, setChip] = useState<'who' | 'kind' | 'due' | null>(null);
  const toggle = (c: 'who' | 'kind' | 'due') => (o: boolean) => setChip(o ? c : null);
  const today = inDays(0);
  const days = due ? daysBetween(today, due) : 0;
  const value = Number(amount.replace(/[$,\s]/g, ''));
  const valid = Number.isFinite(value) && value > 0 && due !== '';
  return (
    <Dialog open={open} onClose={onClose} size="md" aria-labelledby="send-invoice-title">
      <DialogHeader
        id="send-invoice-title"
        icon={InvoiceIcon}
        title="Send an invoice"
        aside={step === 'sent' ? undefined : `Step ${step === 'details' ? 1 : 2} of 2`}
      />
      {step === 'sent' ? (
        <DoneView
          title={`${money(value)} invoice sent to ${who}`}
          detail={`Due ${formatDate(due)}. Zebri will remind them a few days before, and tell you the moment it's paid.`}
        />
      ) : (
        <DialogBody>
          {step === 'details' ? (
            <div className="space-y-6">
              <Input
                icon={PaymentsIcon}
                label="Amount"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                help={`${PACKAGES.classic.name} · ${money(PRICE)}`}
                error={amount.trim() && !(value > 0) ? 'Enter an amount, like 900' : undefined}
                data-autofocus
              />
              <div className="-mx-2.5 flex flex-wrap gap-1">
                <PropertyChip icon={ClientsIcon} label="Client" value={who || undefined} open={chip === 'who'} onOpenChange={toggle('who')} size="menu">
                  {PAYERS.map((p) => (
                    <MenuOption key={p} selected={who === p} onSelect={() => (setWho(p), setChip(null))}>
                      {p}
                    </MenuOption>
                  ))}
                </PropertyChip>
                <PropertyChip icon={ReceiptIcon} label="For" value={`For ${kind.toLowerCase()}`} open={chip === 'kind'} onOpenChange={toggle('kind')} size="menu">
                  {KINDS.map((k) => (
                    <MenuOption
                      key={k}
                      selected={kind === k}
                      onSelect={() => {
                        setKind(k);
                        setAmount(String(AMOUNT[k]));
                        setChip(null);
                      }}
                    >
                      {k}
                    </MenuOption>
                  ))}
                </PropertyChip>
                <PropertyChip
                  icon={CalendarIcon}
                  label="Due"
                  value={due ? `Due ${dayMonth(due)} · in ${days} day${days === 1 ? '' : 's'}` : undefined}
                  open={chip === 'due'}
                  onOpenChange={toggle('due')}
                >
                  <RangeCalendar from={due} to={due} today={today} min={today} onPick={(d) => (setDue(d), setChip(null))} />
                </PropertyChip>
              </div>
            </div>
          ) : (
            <EmailStep
              intro={`${kind}, ${money(value)} for ${who}, with this email`}
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
