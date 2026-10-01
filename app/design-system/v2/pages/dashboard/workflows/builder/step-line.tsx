import { StretchedButton } from '@/components/ui-v2/stretched-button';

import { stepTitle, timingWords, type Step } from '../model';

import { STEP_ICON } from './step-icons';

/**
 * One line of the story: the kind's icon on a soft chip, what happens
 * ("Welcome aboard!", "Send the questionnaire"), and under it who does
 * it: "Zebri sends" in green, "You approve first" for a held send, "You
 * do this" for the MC's own step. When sits in the right-hand column in
 * words, with the date under it while testing with a client. The whole
 * line opens the step. A line Zebri just changed washes grass for a
 * moment, so the MC can see what their ask did.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/builder/step-line
 */

export interface StepLineProps {
  step: Step;
  workflowName: (id: string) => string;
  /** The date while testing with a client. */
  date?: string | undefined;
  selected: boolean;
  changed: boolean;
  onSelect: () => void;
}

/** Who does the step, and in which colour. */
function who(s: Step): { words: string; tone: string } {
  if (s.kind === 'todo' || s.kind === 'appointment') return { words: 'You do this', tone: 'text-zebra-500' };
  if (s.kind === 'if') return { words: 'Otherwise it carries on', tone: 'text-zebra-500' };
  if ((s.kind === 'email' || s.kind === 'document') && s.approve) return { words: 'You approve first', tone: 'text-warning-ink' };
  return { words: s.kind === 'email' || s.kind === 'document' ? 'Zebri sends' : 'Zebri does this', tone: 'text-grass-600' };
}

/** A line of the story. See {@link StepLineProps}. */
export function StepLine({ step, workflowName, date, selected, changed, onSelect }: StepLineProps) {
  const Icon = STEP_ICON[step.kind];
  const w = who(step);
  const title = step.kind === 'email' ? step.subject : stepTitle(step, workflowName);
  return (
    <div
      className={`relative grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-button px-3 py-3 transition-colors duration-500 motion-reduce:transition-none ${
        selected ? 'bg-zebra-950/5' : changed ? 'bg-grass-100' : 'hover:bg-zebra-950/[0.03]'
      }`}
    >
      <span className="relative flex size-7 items-center justify-center rounded-button bg-zebra-100 text-zebra-700">
        <Icon aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
      </span>
      <StretchedButton label={`${title}, ${w.words}, ${timingWords(step.timing)}`} onClick={onSelect}>
        <span className="block truncate type-label text-zebra-950">{title}</span>
        <span className={`block truncate type-body ${w.tone}`}>{w.words}</span>
      </StretchedButton>
      <span className="text-right type-body">
        <span className="block text-zebra-500">{timingWords(step.timing)}</span>
        {date ? <span className="block tabular-nums text-zebra-950">{date}</span> : null}
      </span>
    </div>
  );
}
