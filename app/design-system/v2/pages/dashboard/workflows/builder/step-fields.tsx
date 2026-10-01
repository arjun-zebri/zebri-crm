'use client';

import { Dropdown } from '@/components/ui-v2/dropdown';
import { InlineInput } from '@/components/ui-v2/inline-input';
import { Input } from '@/components/ui-v2/input';
import { Segmented } from '@/components/ui-v2/segmented';
import { Textarea } from '@/components/ui-v2/textarea';

import type { DocKind, Step, Workflow } from '../model';
import { CONDITIONS, STAGES } from '../triggers';

import { PropRow } from './prop-row';
import { TimingField } from './timing-field';

/**
 * The fields for one step, by kind, as a short property list: its timing
 * first as one sentence, then what it needs and nothing more, each
 * picked inline. An email is its subject and message, with
 * `{{…}}` variables Zebri fills per client. Anything that sends can be
 * held for approval; held sends are rewritten for each client and wait
 * in Up next, while sends that go by themselves use this copy as is.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/builder/step-fields
 */

const DOCS: DocKind[] = ['Proposal', 'Contract', 'Invoice', 'Questionnaire', 'Run sheet'];
const SENDING = ['By itself', 'Ask me first'] as const;
const opts = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x.charAt(0).toUpperCase() + x.slice(1) }));

export interface StepFieldsProps {
  step: Step;
  /** Other workflows, for Start a workflow. */
  others: Workflow[];
  onChange: (step: Step) => void;
}

/** A step's fields. See {@link StepFieldsProps}. */
export function StepFields({ step: s, others, onChange }: StepFieldsProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <TimingField value={s.timing} onChange={(timing) => onChange({ ...s, timing })} />
        {s.kind === 'todo' || s.kind === 'appointment' ? (
          <PropRow label={s.kind === 'todo' ? 'To do' : 'Meeting'}>
            <InlineInput
              aria-label={s.kind === 'todo' ? 'What to do' : 'Meeting'}
              value={s.title}
              onChange={(e) => onChange({ ...s, title: e.target.value })}
              className="h-7 w-full rounded-check px-1.5 type-label text-zebra-950 transition-colors duration-150 hover:bg-zebra-950/5 focus:bg-zebra-950/5"
            />
          </PropRow>
        ) : null}
        {s.kind === 'document' ? (
          <PropRow label="Document">
            <Dropdown label="Document" inline options={opts(DOCS)} value={s.doc} onChange={(doc) => onChange({ ...s, doc: doc as DocKind })} />
          </PropRow>
        ) : null}
        {s.kind === 'stage' ? (
          <PropRow label="Move to">
            <Dropdown label="Move them to" inline options={opts(STAGES)} value={s.stage} onChange={(stage) => onChange({ ...s, stage })} />
          </PropRow>
        ) : null}
        {s.kind === 'if' ? (
          <PropRow label="If">
            <Dropdown label="If" inline options={opts(CONDITIONS)} value={s.condition} onChange={(condition) => onChange({ ...s, condition })} />
          </PropRow>
        ) : null}
        {s.kind === 'start' ? (
          <PropRow label="Workflow">
            <Dropdown label="Workflow" inline options={others.map((w) => ({ value: w.id, label: w.name }))} value={s.workflow} onChange={(workflow) => onChange({ ...s, workflow })} />
          </PropRow>
        ) : null}
        {s.kind === 'email' || s.kind === 'document' ? (
          <PropRow
            label="Sending"
            hint={s.approve ? 'Zebri drafts it for each client and waits in Up next for your OK.' : 'Goes out as written, with no check from you.'}
          >
            <Segmented
              label="Sending"
              options={SENDING}
              value={s.approve ? 'Ask me first' : 'By itself'}
              onChange={(v) => onChange({ ...s, approve: v === 'Ask me first' })}
            />
          </PropRow>
        ) : null}
      </div>
      {s.kind === 'email' ? (
        <div className="space-y-4">
          <Input label="Subject" value={s.subject} onChange={(e) => onChange({ ...s, subject: e.target.value })} />
          <Textarea label="Message" rows={10} value={s.body} onChange={(e) => onChange({ ...s, body: e.target.value })} />
        </div>
      ) : null}
    </div>
  );
}
