'use client';

/**
 * The message a send is about to send, in fields.
 *
 * The subject and body are the *rendered* ones, with this couple's
 * details already substituted, so what the MC reads is what goes out -
 * and because they are fields rather than a preview, fixing a line is
 * typing rather than finding an Edit button first. Edits land on this
 * step alone; the saved template behind it is untouched.
 *
 * @module app/(dashboard)/workflows/step-email-edit
 */

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export interface StepEmailEditProps {
  subject: string;
  body: string;
  onSubject: (value: string) => void;
  onBody: (value: string) => void;
}

/** The message fields. See {@link StepEmailEditProps}. */
export function StepEmailEdit({ subject, body, onSubject, onBody }: StepEmailEditProps) {
  return (
    <div className="space-y-3">
      <Input
        label="Subject"
        value={subject}
        onChange={(e) => onSubject(e.currentTarget.value)}
      />
      {/* Fixed: the modal holds one height, and a draggable corner in it
          only pushes the footer around. */}
      <Textarea
        label="Message"
        rows={10}
        value={body}
        onChange={(e) => onBody(e.currentTarget.value)}
      />
    </div>
  );
}
