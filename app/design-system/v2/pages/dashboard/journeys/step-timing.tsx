'use client';

import { MenuOption } from '@/components/ui-v2/popover';

import type { RelTime } from '../../../relative-time/model';
import { RelativeTimePicker } from '../../../relative-time/relative-time-picker';

import type { JourneyStep } from './journeys-data';
import { StepChoice } from './step-choice';
import { StepLate } from './step-late';
import { StepRow } from './step-row';
import { HOURS, sendAtOf } from './step-settings';
import { timingLabel, timingOf, type Timing } from './timing';

/**
 * The step dialog's timing rows: when it goes out (labelled When, so
 * a value like "3 days after the enquiry reply goes out" does not say
 * "goes out" twice), with the hour it goes at (Time) for a step set a time from
 * something; and whether Zebri sends it on its own or waits for the
 * MC's OK. Sent by
 * is left out where nobody sends it: a step the MC sends themselves
 * ("Only when you send it"), a to-do, and an invoice that goes with the
 * contract before it. Every value is a dropdown (`StepChoice`); Sent by
 * reads as plain words, no legend dot (founder, 2026-10-08: the
 * coloured circle was not needed in the dialog).
 *
 * When only offers what makes sense where the step sits (see
 * `timing.ts`). The first step goes as soon as they enquire, which is
 * the journey starting. Every later step goes once the step before it is
 * done, worded from that step ("As soon as they accept the proposal"),
 * or a set time after it, or a set time before or after the wedding; any
 * step can instead wait for the MC to send it. The first step's two
 * choices are a menu; every later step gets the design system's relative
 * time picker (type a time, or one of four usual ones), each reading
 * worded from the step before.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/step-timing
 */

const SENDS = { auto: 'Zebri, automatically', approve: 'You, after approving' } as const;

/** A step's timing as the picker's value. The first step's "start" never reaches the picker. */
function toRel(t: Timing): RelTime | undefined {
  if (t.at === 'manual') return { anchor: 'manual' };
  if (t.at === 'wedding') return { anchor: t.side, amount: t.amount, unit: t.unit };
  if (t.at === 'previous')
    return { anchor: 'previous', amount: t.amount ?? 0, unit: t.unit ?? 'days' };
  return undefined;
}

/** The picker's value as a step's timing. */
function toTiming(r: RelTime): Timing {
  if (r.anchor === 'manual') return { at: 'manual' };
  if (r.anchor === 'previous')
    return r.amount ? { at: 'previous', amount: r.amount, unit: r.unit } : { at: 'previous' };
  return { at: 'wedding', side: r.anchor, amount: r.amount, unit: r.unit };
}

/** The four usual times: counting from the step before, or (after the wedding marker) from the day. */
const USUAL: Record<'follows' | 'wedding', RelTime[]> = {
  follows: [
    { anchor: 'previous', amount: 0, unit: 'days' },
    { anchor: 'previous', amount: 3, unit: 'days' },
    { anchor: 'before', amount: 8, unit: 'weeks' },
    { anchor: 'manual' },
  ],
  wedding: [
    { anchor: 'after', amount: 1, unit: 'days' },
    { anchor: 'after', amount: 1, unit: 'weeks' },
    { anchor: 'after', amount: 1, unit: 'months' },
    { anchor: 'manual' },
  ],
};

export interface StepTimingProps {
  step: JourneyStep;
  /** The step before it on the journey, if any: what "the step before" means here. */
  prev: JourneyStep | undefined;
  onChange: (step: JourneyStep) => void;
  /** New enquiries start on this journey; otherwise it starts when the MC adds a client. */
  starts: boolean;
}

/** What the journey's first step waits for: a new enquiry where enquiries start, otherwise the MC adding a client. */
const startOf = (starts: boolean) => (starts ? 'As soon as they enquire' : 'As soon as you add them');

/** When `step` goes, in words: "As soon as they enquire", "3 days after the proposal". */
export function whenLabel(step: JourneyStep, prev: JourneyStep | undefined, starts: boolean): string {
  const timing = timingOf(step);
  return timing.at === 'start' ? startOf(starts) : timingLabel(timing, prev);
}

/**
 * An hour only means something for a step set days or more from something; "as soon as" goes when it
 * happens, and minutes after a step pins its own moment ("20 minutes after" at "9:00 am" read as nonsense).
 */
export function isTimed(step: JourneyStep): boolean {
  const t = timingOf(step);
  return t.at === 'wedding' || (t.at === 'previous' && Boolean(t.amount) && t.unit !== 'minutes');
}

/**
 * The When picker's content: the first step's two choices as a menu, any
 * later step the relative time picker. Shared by the step panel's When
 * row and the to-do dialog's When chip. `onPick` closes whatever holds it.
 */
export function WhenPicker({ step, prev, starts, onChange, onPick }: StepTimingProps & { onPick: () => void }) {
  const timing = timingOf(step);
  const set = (t: Timing) => (onPick(), onChange({ ...step, timing: t }));
  // After the wedding day marker, "the step before" is the wedding itself, which the wedding choices already say.
  const follows = Boolean(prev && prev.kind !== 'day');
  return prev ? (
    <RelativeTimePicker
      value={toRel(timing)}
      anchors={follows ? ['previous', 'before', 'after'] : ['before', 'after']}
      now={follows}
      quick={USUAL[follows ? 'follows' : 'wedding']}
      onChange={(r) => set(toTiming(r))}
    />
  ) : (
    <>
      <MenuOption selected={timing.at === 'start'} onSelect={() => set({ at: 'start' })}>
        {startOf(starts)}
      </MenuOption>
      <MenuOption selected={timing.at === 'manual'} onSelect={() => set({ at: 'manual' })}>
        Only when you send it
      </MenuOption>
    </>
  );
}

/** The rows. See {@link StepTimingProps}. */
export function StepTiming({ step, prev, onChange, starts }: StepTimingProps) {
  const todo = step.kind === 'todo';
  const timing = timingOf(step);
  const sends = step.approve ? 'approve' : 'auto';
  return (
    <>
      <StepRow label="When">
        <StepChoice label="When" value={whenLabel(step, prev, starts)} labelOf={(v) => v}>
          {(close) => <WhenPicker step={step} prev={prev} starts={starts} onChange={onChange} onPick={close} />}
        </StepChoice>
      </StepRow>
      {isTimed(step) ? (
        <StepRow label="Time">
          <StepChoice label="Time" value={sendAtOf(step)} options={HOURS} labelOf={(h) => h} onChange={(h) => onChange({ ...step, sendAt: h })} />
        </StepRow>
      ) : null}
      {!todo && timing.at === 'wedding' && timing.side === 'before' ? <StepLate step={step} onChange={onChange} /> : null}
      {todo || timing.at === 'manual' ? null : (
        <StepRow label="Sent by">
          <StepChoice label="Sent by" value={sends} options={['auto', 'approve'] as const} labelOf={(k) => SENDS[k]} onChange={(k) => onChange({ ...step, approve: k === 'approve' })} />
        </StepRow>
      )}
    </>
  );
}
