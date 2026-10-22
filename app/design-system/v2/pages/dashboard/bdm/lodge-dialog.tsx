'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';


import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { Dropdown } from '@/components/ui-v2/dropdown';
import { BdmIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { PasswordInput } from '@/components/ui-v2/password-input';

import { answerText } from '../questionnaires/questionnaire-data';
import { ReadBack } from '../questionnaires/read-back';

import { CELEBRANT_CODES, type CertificateOrder, type Paperwork } from './bdm-data';
import { lodge, patchCelebrant, registryAnswer, useCelebrant, type LodgeError } from './bdm-store';
import { CertificateOrderFields, postedTo } from './certificate-order';
import { LODGE_ERRORS, LOGIN_ERROR, readDetail } from './lodge-errors';
import { issuesOf, type Issue } from './rules';

/**
 * Lodge with BDM: the last step, over the paperwork. It asks for the
 * celebrant's eRegistry login, because the Registry's B2B service takes
 * it with each lodgement, and says plainly that the password is used
 * for this one lodgement and never kept (the username is remembered).
 * The first time, it also asks for the celebrant's registration code and
 * number (the only celebrant details the account cannot fill in), and
 * keeps them in Settings, so nothing has to be set up before the first
 * lodgement. Each of those is its own titled part, ruled off from the
 * next, so it reads in three glances (tightened 2026-10-12). It opens on
 * what goes (the couple, the day, the certificate number), since lodging
 * cannot be taken back, and every field is a ledger row with its name
 * (user, 2026-10-15: icon-led lines read as "AA A" and "2133").
 * Ordering the couple's certificate is its own question,
 * off until ticked (`certificate-order.tsx`: design, speed, copies, where it goes). When
 * the Registry turns it away (`lodge-errors.ts`) the dialog stays open
 * and says why: a wrong login under the password, anything else in a
 * red line above the buttons (as every v2 error is, no banner), each
 * saying nothing was lodged. Cancel stays, `plain`, though this is a
 * form: lodging is irreversible, so it gets a confirmation's "no". Lodging waits a beat, as
 * the Registry would, then closes on the paperwork showing it lodged.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/lodge-dialog
 */

/** Long enough to read as the Registry answering. */
const LODGE_MS = 1400;

export interface LodgeDialogProps {
  open: boolean;
  paper: Paperwork;
  onClose: () => void;
  /** Shows the answer BDM would not take, when its error names one. */
  onGoto?: ((issue: Issue) => void) | undefined;
}

/** The lodge dialog. See {@link LodgeDialogProps}. */
export function LodgeDialog({ open, paper: p, onClose, onGoto }: LodgeDialogProps) {
  const celebrant = useCelebrant();
  // Asked once: the first lodgement, before the registration number is known.
  const [first] = useState(celebrant.number === '');
  const [code, setCode] = useState(celebrant.code);
  const [number, setNumber] = useState(celebrant.number);
  const [username, setUsername] = useState(celebrant.username);
  // Held only while this dialog is open: never written to the store.
  const [password, setPassword] = useState('');
  // Off until asked for: it costs money, so it is never a default.
  const [order, setOrder] = useState<CertificateOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LodgeError | null>(null);
  const [detail, setDetail] = useState<string | undefined>(undefined);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const submit = () => {
    setBusy(true);
    setError(null);
    timer.current = window.setTimeout(() => {
      setBusy(false);
      // The password goes with this one attempt only, whatever the answer.
      setPassword('');
      const reply = registryAnswer(password);
      if ('error' in reply) return (setError(reply.error), setDetail(reply.detail));
      patchCelebrant({ username, code, number });
      lodge(p.client, reply.status, order ?? undefined);
      onClose();
    }, LODGE_MS);
  };
  // An order with nowhere to post it would be refused, so it holds the lodgement back.
  // The Lodge step already holds back paperwork with issues; checked again here, since this is what sends it.
  const ready = Boolean(username && password && number.trim() && (!order || postedTo(p, celebrant, order)) && issuesOf(p).length === 0);
  const named = detail ? readDetail(detail, p.names) : null;
  return (
    <Dialog open={open} onClose={busy ? () => undefined : onClose} size="form" aria-labelledby="lodge-title">
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !busy) submit();
        }}
      >
        <DialogHeader id="lodge-title" icon={BdmIcon} title={`Lodge ${p.client}'s marriage`} />
        {/* A part each, ruled apart, so one part's values never read into the next. */}
        <DialogBody>
          <div className="divide-y divide-hairline">
            {/* What is about to go, read once more: lodging cannot be taken back. */}
            <Part title="What goes to BDM">
              <ReadBack compact rows={sentOf(p)} />
            </Part>
            {first ? (
              <Part title="Your registration" note="As on the Register of Marriage Celebrants. Asked once.">
                <div className="space-y-0.5">
                  <Dropdown row label="Celebrant code" options={CELEBRANT_CODES.map((c) => ({ value: c, label: c }))} value={code} onChange={setCode} />
                  <Input row label="Registration number" inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} />
                </div>
              </Part>
            ) : null}
            <Part title="Your eRegistry login" note="Sent to NSW BDM with this lodgement. Your password is never kept.">
              <div className="space-y-0.5">
                <Input row label="Username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
                <PasswordInput row label="Password" autoComplete="current-password" value={password} error={error === 'login' ? LOGIN_ERROR : undefined} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </Part>
            <Part title="Their marriage certificate" note="Printed once the marriage is registered.">
              <CertificateOrderFields paper={p} celebrant={celebrant} value={order} onChange={setOrder} />
            </Part>
          </div>
          {error && error !== 'login' ? (
            <div role="alert" className="mt-2 space-y-1 type-body">
              <p className="text-danger">
                {LODGE_ERRORS[error].title}. {LODGE_ERRORS[error].detail}
              </p>
              {named ? (
                <p className="flex flex-wrap items-center gap-x-3 text-zebra-700">
                  <span>BDM would not take: {named.label}.</span>
                  {onGoto ? (
                    <Button type="button" variant="plain" onClick={() => (onClose(), onGoto({ key: named.key, label: named.label, problem: detail ?? '' }))}>
                      Go to it
                    </Button>
                  ) : null}
                </p>
              ) : detail ? (
                <p className="text-zebra-700">The Registry said: &ldquo;{detail}&rdquo;</p>
              ) : null}
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="plain" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!ready}>
            {error === 'down' ? 'Try again' : 'Lodge with BDM'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

/** The marriage as it is lodged, in a few lines. */
function sentOf(p: Paperwork): [string, string][] {
  return [
    ['Couple', p.names.filter((n) => n.trim()).join(' and ')],
    ['Married', [p.date, p.venue].filter((v) => v.trim() && !/to come$/i.test(v)).join(' · ')],
    ['Certificate number', answerText(p.checks.certNumber)],
  ];
}

/** One part of the dialog: its title and a line on it, then its fields. */
function Part({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 py-5 first:pt-0">
      <div className="space-y-0.5">
        <h3 className="type-label text-zebra-950">{title}</h3>
        {note ? <p className="type-body text-zebra-500">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}
