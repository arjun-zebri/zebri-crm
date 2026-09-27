'use client';

/**
 * The message a held send is about to send, in the Compose editor.
 *
 * The same subject field and rich editor as the builder's Compose email
 * modal, holding the message as written: variables stay variables (so
 * an unfilled one still holds the send), and bold, lists, links and the
 * signature survive an edit (live check B2). What it renders to for this
 * couple is the preview under it. Edits land on this step alone; the
 * saved template behind it is untouched.
 *
 * @module app/(dashboard)/workflows/step-email-edit
 */

import type { JSONContent } from '@tiptap/react';

import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { EMAIL_TEMPLATE_VARIABLES } from '@/lib/email/template-variables';

import { SubjectField } from '../templates/subject-field';

export interface StepEmailEditProps {
  subject: string;
  onSubject: (value: string) => void;
  /** The body the editor opens with. Key the component to re-seed it. */
  initialContent: JSONContent;
  onContent: (doc: JSONContent) => void;
  /** The editor's own form of `initialContent`, once, on mount. */
  onBaseline: (doc: JSONContent) => void;
  /** The step stores a pre-composer plain-text body. */
  legacyText: boolean;
}

/** The message fields. See {@link StepEmailEditProps}. */
export function StepEmailEdit({
  subject,
  onSubject,
  initialContent,
  onContent,
  onBaseline,
  legacyText,
}: StepEmailEditProps) {
  return (
    <div className="space-y-3">
      <SubjectField value={subject} onChange={onSubject} />
      <div>
        <p className="mb-1 text-body font-medium text-text">Message</p>
        <RichTextEditor
          value={initialContent}
          onChange={onContent}
          onReady={onBaseline}
          variables={EMAIL_TEMPLATE_VARIABLES}
          placeholder="Write the email the couple receives…"
          dense
        />
        {/* Saved as rich text once edited, as Compose saves it, which
            changes what a gap does: say so before it happens. */}
        {legacyText ? (
          <p className="mt-1.5 text-body text-text-muted">
            This email was written before rich text. Editing the message saves it as rich text, so
            a detail the couple is missing will hold it until filled.
          </p>
        ) : null}
      </div>
    </div>
  );
}
