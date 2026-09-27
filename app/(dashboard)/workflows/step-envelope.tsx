'use client';

/**
 * The envelope of a held send, above its rendered email.
 *
 * From, To (with anyone left out and why), your own copy, Reply-to, When and
 * Attachments, plus anything the message could not fill in. Every value
 * comes from the server, decided by the send's own functions
 * (`lib/workflows/send-envelope`), so this only lays it out: a plain
 * label and value per line, no box, so it reads as the top of the email
 * rather than another panel.
 *
 * @module app/(dashboard)/workflows/step-envelope
 */

import type { ReactNode } from 'react';

import type { EnvelopeRecipient, SendEnvelope } from '@/lib/workflows/send-envelope';

import { StepEnvelopeGaps } from './step-envelope-gaps';

export interface StepEnvelopeProps {
  envelope: SendEnvelope;
  /** A newer render is on its way; dim like the frame below. */
  pending?: boolean;
}

const VIA: Record<SendEnvelope['via'], string> = {
  zebri: 'Zebri shared address',
  gmail: 'your Gmail',
  outlook: 'your Outlook',
};

const SKIPPED: Record<NonNullable<EnvelopeRecipient['skipped']>, string> = {
  couple_opted_out: 'skipped, the couple opted out of email',
  suppressed: 'skipped, unsubscribed or bounced',
};

/** One label and its value. The value column wraps, never overflows. */
function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-text">{children}</dd>
    </div>
  );
}

/** An address that breaks anywhere rather than pushing the modal wide. */
function Address({ children }: { children: string }) {
  return <span className="break-all text-text-muted">{children}</span>;
}

/** One recipient: name, address, and why they are left out if they are. */
function Recipient({ r }: { r: EnvelopeRecipient }) {
  return (
    <li className={r.skipped ? 'text-text-subtle' : undefined}>
      {r.name ? <span className="mr-1.5">{r.name}</span> : null}
      <Address>{r.email}</Address>
      {r.copy && !r.skipped ? <span className="text-text-subtle"> (its own email)</span> : null}
      {r.skipped ? <span> ({SKIPPED[r.skipped]})</span> : null}
    </li>
  );
}

/** When the send goes, in words. */
function when(sendAt: SendEnvelope['sendAt']): string | null {
  if (!sendAt) return null;
  if (sendAt.kind === 'now') return 'Now';
  if (sendAt.kind === 'unscheduled') return 'Once the step before it is done';
  if (sendAt.kind === 'held') return 'Held until the missing details are filled in';
  return sendAt.label;
}

/** The envelope. See {@link StepEnvelopeProps}. */
export function StepEnvelope({ envelope, pending = false }: StepEnvelopeProps) {
  // A finished step's recipients are history; working them out from
  // today's contacts and opt-outs would misreport who it reached, so a
  // settled envelope is its notice alone.
  if (envelope.settled) {
    return envelope.notice ? (
      <p aria-label="Envelope" className="text-body text-text-muted">
        {envelope.notice}
      </p>
    ) : null;
  }
  const time = when(envelope.sendAt);
  return (
    <section
      aria-label="Envelope"
      aria-busy={pending}
      className={`space-y-1.5 text-body transition-opacity ${pending ? 'opacity-50' : ''}`}
    >
      <dl className="space-y-1.5">
        <Line label="From">
          {envelope.fromName ? <span className="mr-1.5">{envelope.fromName}</span> : null}
          <Address>{envelope.fromAddress}</Address>
          <span className="text-text-subtle"> via {VIA[envelope.via]}</span>
        </Line>
        {envelope.to.length > 0 ? (
          <Line label="To">
            <ul className="space-y-0.5">
              {envelope.to.map((r) => (
                <Recipient key={r.email} r={r} />
              ))}
            </ul>
          </Line>
        ) : null}
        {/* A separate email to the MC, sent after the couple's: never a
            bcc on theirs, so it cannot carry their unsubscribe link. */}
        {envelope.mcCopy ? (
          <Line label="Your copy">
            <Address>{envelope.mcCopy}</Address>
            <span className="text-text-subtle"> (its own email)</span>
          </Line>
        ) : null}
        {envelope.replyTo ? (
          <Line label="Reply-to">
            <Address>{envelope.replyTo}</Address>
          </Line>
        ) : null}
        {time ? <Line label="When">{time}</Line> : null}
        {envelope.attachments.length > 0 ? (
          <Line label="Attached">
            <span className="break-words">{envelope.attachments.join(', ')}</span>
          </Line>
        ) : null}
      </dl>

      {envelope.notice ? <p className="text-text-muted">{envelope.notice}</p> : null}

      <StepEnvelopeGaps
        unresolved={envelope.unresolved}
        unknown={envelope.unknown ?? []}
        holds={envelope.unresolvedHolds}
      />
    </section>
  );
}
