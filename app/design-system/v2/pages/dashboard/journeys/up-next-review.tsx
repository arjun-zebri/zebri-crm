'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { EmailIcon, MessageIcon, SparklesIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { Textarea } from '@/components/ui-v2/textarea';

import { coupleName } from '../payments/payments-data';

import { STEP_ICON, type Journey } from './journeys-data';
import type { QueueItem } from './up-next-data';

/**
 * Reading one held send before it goes, built from the dialog parts
 * like a journey's to-do dialog: the header is the step's glyph with
 * whose it is and which journey; then Zebri's note on why it is going
 * now (the AI highlight with the sparkle, so it reads as Zebri's), the
 * subject as a line led by its icon and the message as a textarea
 * under it, both written for this client. Skip this one and
 * Send sit in the foot.
 * Send sends what is on screen; nothing sends until it is pressed here.
 * Keyed by item by the caller, so each opens on its draft as it stands.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/up-next-review
 */

/** A message as it will go. */
export interface Draft {
  subject: string;
  body: string;
}

export interface UpNextReviewProps {
  item: QueueItem | null;
  /** The journey it comes from. */
  journey: Journey | undefined;
  draft: Draft | null;
  sending: boolean;
  onClose: () => void;
  onSend: (draft: Draft) => void;
  /** Leaves this one out for this client; the journey carries on. */
  onSkip: () => void;
}

/** The review dialog. See {@link UpNextReviewProps}. */
export function UpNextReview({
  item,
  journey,
  draft: start,
  sending,
  onClose,
  onSend,
  onSkip,
}: UpNextReviewProps) {
  const [draft, setDraft] = useState<Draft>(start ?? { subject: '', body: '' });
  const step = journey?.steps.find((s) => s.id === item?.step);
  return (
    <Dialog open={item !== null} onClose={onClose} size="form" aria-labelledby="review-title">
      <DialogHeader id="review-where" icon={step ? STEP_ICON[step.kind] : EmailIcon} title={`${item ? coupleName(item.names) : ''} · ${journey?.name ?? ''}`} />
      <DialogBody className="flex flex-col gap-6">
        <span id="review-title" className="sr-only">
          {item?.label}
        </span>
        {item?.why ? (
          // Zebri's note on why it is going now: the AI highlight with the sparkle, so it reads as Zebri's.
          <p className="surface-highlight flex items-start gap-2.5 rounded-button px-3 py-2.5 type-body text-zebra-950">
            <SparklesIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-azure-500" />
            {item.why}
          </p>
        ) : null}
        {/* Option G (2026-10-14): the subject is a line led by its icon, the message under it. */}
        <div className="space-y-1">
          <Input
            icon={MessageIcon}
            label="Subject"
            wide
            value={draft.subject}
            disabled={sending}
            onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
          />
          <Textarea
            grow
            rows={8}
            label="Message"
            value={draft.body}
            disabled={sending}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
          />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="plain" onClick={onSkip} disabled={sending}>
          Skip this one
        </Button>
        <Button
          onClick={() => onSend(draft)}
          loading={sending}
          disabled={!draft.subject.trim() || !draft.body.trim()}
          data-autofocus
        >
          Send to {item ? item.names.join(' & ') : ''}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
