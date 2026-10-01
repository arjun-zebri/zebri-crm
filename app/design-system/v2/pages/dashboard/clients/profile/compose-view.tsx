'use client';

import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Input } from '@/components/ui-v2/input';
import { Select } from '@/components/ui-v2/select';
import { Textarea } from '@/components/ui-v2/textarea';

import type { Person, Task } from './profile-data';
import { GUTTER } from './profile-header';

/**
 * Reviewing a drafted message: it takes over the main area under the
 * client's name (the sidebar stays), with a back arrow to the timeline
 * as the one way out, who it goes to (changeable), the subject for an
 * email, and the draft ready to edit. The form keeps to a readable
 * width, as a letter would, rather than the panel's full width. Sending takes a beat and
 * returns to the timeline, where the step is now ticked. Every edit is
 * reported up through `onEdit` and handed back as `saved`, so leaving
 * and coming back finds the message as it was left.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/compose-view
 */

// Long enough to read as work happening, short enough not to wait on.
const SEND_MS = 700;

/** A draft as the MC left it. */
export interface Edit {
  to: string;
  subject: string;
  body: string;
}

export interface ComposeViewProps {
  step: Task;
  people: Person[];
  /** Edits kept from an earlier visit; the draft as written otherwise. */
  saved?: Edit | undefined;
  onEdit: (e: Edit) => void;
  onSent: (step: Task) => void;
  onBack: () => void;
}

/** The compose view. See {@link ComposeViewProps}. */
export function ComposeView({ step, people, saved, onEdit, onSent, onBack }: ComposeViewProps) {
  const draft = step.draft;
  const email = draft.channel === 'Email';
  const first = people.find((p) => p.name.startsWith(draft.to));
  // Email can go to both people at once; a WhatsApp goes to one phone.
  const options = [
    ...people.map((p) => p.name),
    ...(email && people.length > 1 ? [people.map((p) => p.name.split(' ')[0]).join(' and ')] : []),
  ];
  const [to, setTo] = useState(saved?.to ?? first?.name ?? options[0] ?? '');
  const [subject, setSubject] = useState(saved?.subject ?? draft.subject ?? '');
  const [body, setBody] = useState(saved?.body ?? draft.body);
  const [sending, setSending] = useState(false);
  const edit = (e: Partial<Edit>) => onEdit({ to, subject, body, ...e });
  const send = () => {
    setSending(true);
    window.setTimeout(() => onSent(step), SEND_MS);
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col motion-safe:animate-[fade-in_200ms_ease-out_both]">
      {/* -ml-2 puts the arrow's glyph on the content edge, like the text below. */}
      <div className={`flex items-center gap-2 pb-5 pt-6 ${GUTTER}`}>
        <Button
          variant="ghost"
          square
          aria-label="Back to the timeline"
          onClick={onBack}
          className="-ml-2"
        >
          <ArrowLeft aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </Button>
        <h3 className="min-w-0 truncate type-subheading text-zebra-950">
          {step.cta} · {step.label}
        </h3>
      </div>
      <div className={`min-h-0 flex-1 overflow-y-auto pb-10 ${GUTTER}`}>
        <div className="max-w-2xl space-y-4">
          <Select
            label={email ? 'To' : 'WhatsApp to'}
            options={options}
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              edit({ to: e.target.value });
            }}
            disabled={sending}
          />
          {email ? (
            <Input
              label="Subject"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                edit({ subject: e.target.value });
              }}
              disabled={sending}
            />
          ) : null}
          <Textarea
            label="Message"
            rows={email ? 10 : 5}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              edit({ body: e.target.value });
            }}
            disabled={sending}
            data-autofocus
          />
          <div className="flex items-center gap-4">
            <p className="min-w-0 flex-1 type-body text-zebra-500">
              Drafted by Zebri. Your edits are kept until you send.
            </p>
            <Button onClick={send} loading={sending} disabled={!body.trim()}>
              Send {email ? 'email' : 'on WhatsApp'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
