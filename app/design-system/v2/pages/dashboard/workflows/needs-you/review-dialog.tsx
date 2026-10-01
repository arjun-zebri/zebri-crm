'use client';

import { Sparkles, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { Input } from '@/components/ui-v2/input';
import { Textarea } from '@/components/ui-v2/textarea';

import { coupleName } from '../../payments/payments-data';
import type { QueueItem } from '../queue-data';
import type { Draft } from '../zebri-chat';

/**
 * Reading one message before it goes, in a `form` dialog: Zebri's note
 * on why it is going now, set apart in the grass-to-sky AI hairline with
 * the Sparkles mark so it reads as Zebri's, then the subject and message
 * Zebri wrote for this client as plain labelled fields (a borderless
 * letter did not read as editable on Payments). Send sends what is on
 * screen, and nothing sends until it is pressed here. Keyed by item by
 * the caller, so each opens on the draft as it stands.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/needs-you/review-dialog
 */

export interface ReviewDialogProps {
  item: QueueItem | null;
  draft: Draft | null;
  workflow: string;
  sending: boolean;
  onClose: () => void;
  onSend: (draft: Draft) => void;
  /** Leaves this one out for this client; the workflow carries on. */
  onSkip: () => void;
}

/** The review dialog. See {@link ReviewDialogProps}. */
export function ReviewDialog({ item, draft: start, workflow, sending, onClose, onSend, onSkip }: ReviewDialogProps) {
  const [draft, setDraft] = useState<Draft>(start ?? { subject: '', body: '' });
  const to = item ? item.names.join(' & ') : '';
  return (
    <Dialog open={item !== null} onClose={onClose} size="form" aria-labelledby="review-title">
      <header className="flex items-start gap-4 border-b border-zebra-950/5 px-6 py-4">
        <div className="min-w-0 flex-1 space-y-0.5">
          <h2 id="review-title" className="type-subheading text-zebra-950">
            {item?.label}
          </h2>
          <p className="type-body text-zebra-500">
            {item ? coupleName(item.names) : ''} · {workflow}
          </p>
        </div>
        <Button variant="ghost" square aria-label="Close" onClick={onClose}>
          <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {item?.why ? (
          <p className="surface-highlight flex items-start gap-2.5 rounded-button px-3 py-2.5 type-body text-zebra-800">
            <Sparkles aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-4 shrink-0 text-azure-500" />
            {item.why}
          </p>
        ) : null}
        <Input label="Subject" value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} disabled={sending} />
        <Textarea label="Message" rows={11} value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} disabled={sending} />
      </div>
      <footer className="flex items-center justify-between gap-3 border-t border-zebra-950/5 px-6 py-4">
        <Button variant="plain" onClick={onSkip} disabled={sending}>
          Skip this one
        </Button>
        <Button onClick={() => onSend(draft)} loading={sending} disabled={!draft.subject.trim() || !draft.body.trim()} data-autofocus>
          Send to {to}
        </Button>
      </footer>
    </Dialog>
  );
}
