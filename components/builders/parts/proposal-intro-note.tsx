/**
 * The personal note to the couple, rendered at the `introNote` marker on
 * the public page. Rich text with the couple/business variables.
 *
 * @module components/builders/parts/proposal-intro-note
 */
'use client';

import type { JSONContent } from '@tiptap/core';

import { RichTextEditor } from '@/components/ui/rich-text-editor';

const VARIABLES = [
  { id: 'couple_name', label: 'Couple name', description: 'The couple as named on their profile' },
  { id: 'event_date', label: 'Event date', description: 'Their next event date' },
  { id: 'venue', label: 'Venue', description: 'Their venue' },
  { id: 'business_name', label: 'Business name', description: 'Your business name' },
] as const;

const EMPTY: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

export interface ProposalIntroNoteProps {
  value: JSONContent | null;
  canEdit: boolean;
  onChange: (value: JSONContent) => void;
}

/** See {@link ProposalIntroNoteProps}. */
export function ProposalIntroNote({ value, canEdit, onChange }: ProposalIntroNoteProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-body font-medium uppercase tracking-wide text-text-muted">Personal note</h4>
      <RichTextEditor
        value={value ?? EMPTY}
        onChange={onChange}
        editable={canEdit}
        placeholder="Hi {{couple_name}}, I loved hearing about your day..."
        variables={VARIABLES}
        showVariableInserter
        dense
      />
    </div>
  );
}
