'use client';

import { useState, type ReactNode } from 'react';

import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { Input } from '@/components/ui-v2/input';
import { Textarea } from '@/components/ui-v2/textarea';

/**
 * The pieces every Home dialog shares: the header (title, and a quiet
 * note on the right such as "Step 1 of 3"), the footer that holds the
 * buttons, the "done" view a dialog lands on after sending or saving,
 * and {@link useSend}, the short pretend wait while it does.
 *
 * @module app/design-system/v2/pages/dashboard/home/dialog-parts
 */

/** A dialog's title row. `id` is what the dialog's `aria-labelledby` points at. */
export function DialogHeader({
  id,
  title,
  note,
}: {
  id: string;
  title: string;
  note?: string | undefined;
}) {
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-zebra-950/5 px-6 py-4">
      <h2 id={id} className="type-subheading text-zebra-950">
        {title}
      </h2>
      {note ? <p className="type-body text-zebra-500">{note}</p> : null}
    </header>
  );
}

/** The scrolling middle of a dialog. */
export function DialogBody({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>;
}

/** The button row at the foot of a dialog, primary action last. */
export function DialogFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="flex items-center justify-end gap-3 border-t border-zebra-950/5 px-6 py-4">
      {children}
    </footer>
  );
}

/**
 * What a dialog shows once its job is done: a check that draws itself,
 * what happened, and what happens next. It fills the body, so the
 * dialog keeps its height.
 */
export function DoneView({ title, detail }: { title: string; detail: string }) {
  return (
    <div
      role="status"
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-pill bg-grass-100 text-grass-800">
        <DrawnCheck className="size-6" />
      </span>
      <p className="type-subheading text-zebra-950">{title}</p>
      <p className="max-w-sm text-balance type-body text-zebra-500">{detail}</p>
    </div>
  );
}

// Long enough to read as work happening, short enough not to wait on.
const SEND_MS = 700;

/** A pretend send: `busy` for a beat, then `then` runs. The preview sends nothing. */
export function useSend() {
  const [busy, setBusy] = useState(false);
  const send = (then: () => void) => {
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      then();
    }, SEND_MS);
  };
  return { busy, send };
}

/** An email Zebri has written, as plain fields to edit. */
export interface Mail {
  subject: string;
  body: string;
}

export interface EmailStepProps {
  /** One line on what goes with it ("Deposit, $900 for Ella & Noah, with this email"). */
  intro: string;
  mail: Mail;
  onChange: (mail: Mail) => void;
  disabled: boolean;
}

/** The last step of a send: the drafted email, ready to edit. See {@link EmailStepProps}. */
export function EmailStep({ intro, mail, onChange, disabled }: EmailStepProps) {
  return (
    <div className="space-y-4">
      <p className="type-body text-zebra-500">{intro}</p>
      <Input
        label="Subject"
        value={mail.subject}
        onChange={(e) => onChange({ ...mail, subject: e.target.value })}
        disabled={disabled}
      />
      <Textarea
        label="Message"
        rows={10}
        value={mail.body}
        onChange={(e) => onChange({ ...mail, body: e.target.value })}
        disabled={disabled}
        data-autofocus
      />
    </div>
  );
}
