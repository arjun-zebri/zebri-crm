'use client';

import { useState } from 'react';

import { Avatar } from '@/components/ui-v2/avatar';
import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { Textarea } from '@/components/ui-v2/textarea';

import type { Message } from '../demo-data';

import { DialogBody, DialogFooter, DialogHeader, useSend } from './dialog-parts';

/**
 * Replying to a message from Home's Up next panel, in a `form` dialog:
 * their message at the top, then Zebri's drafted reply in an ordinary
 * field, so editing it is just typing. Send takes a beat and closes;
 * the panel then folds the message's row away.
 * Keyed by the caller, so each opens on a fresh draft.
 *
 * @module app/design-system/v2/pages/dashboard/home/reply-dialog
 */

export interface ReplyDialogProps {
  /** The message being answered; `null` keeps the dialog shut. */
  message: Message | null;
  draft: string;
  onSent: () => void;
  onClose: () => void;
}

/** The reply dialog. See {@link ReplyDialogProps}. */
export function ReplyDialog({ message, draft, onSent, onClose }: ReplyDialogProps) {
  const [text, setText] = useState(draft);
  const { busy, send } = useSend();
  const first = message?.from.split(' ')[0] ?? '';
  return (
    <Dialog open={message !== null} onClose={onClose} size="form" aria-labelledby="reply-title">
      <DialogHeader
        id="reply-title"
        title={`Reply to ${first}`}
        note={message ? `${message.ago} ago` : undefined}
      />
      <DialogBody>
        {message ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <Avatar name={message.from} tone="muted" />
              <p className="type-body">
                <span className="type-label text-zebra-950">{message.from}</span>
                <span className="block text-zebra-700">{message.preview}</span>
              </p>
            </div>
            <Textarea
              label="Your reply"
              help="Drafted by Zebri"
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
              data-autofocus
            />
          </div>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="plain" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button loading={busy} disabled={!text.trim()} onClick={() => send(onSent)}>
          Send to {first}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
