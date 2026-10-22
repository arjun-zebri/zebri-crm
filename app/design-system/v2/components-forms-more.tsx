'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Checkbox } from '@/components/ui-v2/checkbox';
import { ArrowUpIcon } from '@/components/ui-v2/icons';
import { InlineInput } from '@/components/ui-v2/inline-input';
import { PromptBox } from '@/components/ui-v2/prompt-box';
import { Switch } from '@/components/ui-v2/switch';
import { TimeField } from '@/components/ui-v2/time-field';
import { amountLabel, readAmount, type Amount } from '@/components/ui-v2/value-menu';
import { ValuePicker } from '@/components/ui-v2/value-picker';

import { DemoRow, Spec } from './showroom-v2';

type Unit = 'days' | 'weeks' | 'months';
const UNITS: Unit[] = ['days', 'weeks', 'months'];
const MAX: Record<Unit, number> = { days: 180, weeks: 26, months: 12 };
const DUE: Amount<Unit>[] = [3, 7, 14, 30].map((n) => ({ n, unit: 'days' }));
const DEPOSITS: Amount<'%'>[] = [10, 20, 25, 30, 50].map((n) => ({ n, unit: '%' }));

/**
 * v2 inputs, the second half: the boxless InlineInput and TimeField,
 * the value picker, Checkbox, Switch and the prompt box, each in its own entry. Rendered
 * inside the Inputs group by `components-forms.tsx`.
 *
 * @module app/design-system/v2/components-forms-more
 */
export function ComponentsFormsMoreV2() {
  const [live, setLive] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [time, setTime] = useState('6:30 pm');
  const [due, setDue] = useState<Amount<Unit>>({ n: 7, unit: 'days' });
  const [deposit, setDeposit] = useState<Amount<'%'>>({ n: 25, unit: '%' });
  return (
    <>
      <Spec
        name="Value picker"
        file="components/ui-v2/value-picker.tsx"
        description="The default for every setting with usual values that takes a custom one (a deposit, a due date, a reminder). The value sits on a small white button; its menu opens on a line to type any value over the common choices. Typing replaces the choices with what it could mean: 9 lists 9 days, 9 weeks, 9 months, and 9 w narrows to weeks. Enter takes the first. No Custom… row: typing is the custom value, and a value that is not a choice is listed first, ticked. A chip or row that already opens a menu renders its `ValueMenu` inside."
      >
        <DemoRow>
          <ValuePicker label="Due in" value={due} presets={DUE} show={amountLabel} read={(t) => readAmount(t, UNITS, MAX)} onPick={setDue} />
          <ValuePicker label="Deposit" value={deposit} presets={DEPOSITS} show={amountLabel} read={(t) => readAmount(t, ['%'] as const, { '%': 100 })} placeholder="Type a percent…" onPick={setDeposit} />
        </DemoRow>
      </Spec>
      <Spec
        name="Inline input"
        file="components/ui-v2/inline-input.tsx"
        description="Boxless, for a value edited in place inside content (a document or section title, a package line, a run sheet row, a detail in a client's Overview), never a form field: a form's fields are option G Inputs, led by their icon. It takes the type role of the line it sits in; `underline` marks a value inside a sentence; `muted` is the quieter line under a main one; `tint` is a detail that reads as text but can be typed into (a client's Overview). Text entry: focus is the caret, no mark."
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <InlineInput aria-label="Package name" placeholder="Package name" defaultValue="Ceremony only" className="flex-1 type-heading" />
            <InlineInput aria-label="Price in dollars" inputMode="numeric" placeholder="0" defaultValue="900" className="w-24 text-right type-heading" />
          </div>
          <p className="flex items-baseline gap-x-2 type-lead text-zebra-700">
            Couples pay
            <InlineInput aria-label="Deposit percent" underline suffix="%" inputMode="numeric" defaultValue="25" className="type-lead text-zebra-950" />
            to lock in their date.
          </p>
          <div>
            <InlineInput aria-label="Moment" defaultValue="First dance" className="w-full type-body" />
            <InlineInput aria-label="Cue" muted placeholder="Add a cue" defaultValue="Perfect, Ed Sheeran" className="w-full type-body" />
          </div>
          <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-x-4 type-body">
            <span className="text-zebra-500">Venue</span>
            <InlineInput aria-label="Venue" tint placeholder="Add" defaultValue="Hawthorn Hall" className="w-full type-body" />
          </div>
        </div>
      </Spec>
      <Spec
        name="Time field"
        file="components/ui-v2/time-field.tsx"
        description="A time of day as a boxless line: focus drops a list in 15-minute steps to click, typing works at the same time and is read loosely (6, 630, 6:30 pm, 18:30; a bare 1 to 6 is afternoon), Up and Down nudge, and leaving tidies it. Used for a run sheet's moments."
      >
        <div className="flex items-baseline gap-4">
          <TimeField aria-label="Time" value={time} onChange={setTime} className="w-20 type-body" />
          <span className="type-label text-zebra-950">First dance</span>
        </div>
      </Spec>
      <Spec
        name="Checkbox"
        file="components/ui-v2/checkbox.tsx"
        description="A choice made on submit. The native input, restyled: checked fills the selected green; keyboard focus is the focus mark on the box."
      >
        <DemoRow>
          <Checkbox label="Send me a copy" />
          <Checkbox label="Remind me the day before" defaultChecked />
          <Checkbox label="Unavailable" disabled />
        </DemoRow>
      </Spec>
      <Spec
        name="Switch"
        file="components/ui-v2/switch.tsx"
        description="A setting that takes effect at once. The thumb glides and squashes in flight, and the house tick fades in as it lands."
      >
        <DemoRow>
          <label className="flex items-center gap-3 type-body text-zebra-950">
            <Switch checked={live} onChange={setLive} aria-label="Intro call bookable" />
            Intro call {live ? 'is live' : 'is paused'}
          </label>
          <Switch checked={false} onChange={() => {}} disabled aria-label="Unavailable setting" />
        </DemoRow>
      </Spec>
      <Spec
        name="Prompt box"
        file="components/ui-v2/prompt-box.tsx"
        description="The Ask Zebri composer: a lead-size text area that grows with its text, tools on the left of its toolbar, actions on the right. Enter sends, Shift+Enter breaks the line. Text entry, so no focus mark: focus is the caret."
      >
        <div className="max-w-2xl">
          <PromptBox
            label="Ask Zebri"
            placeholder="Ask Zebri anything"
            value={prompt}
            onChange={setPrompt}
            onSubmit={() => setPrompt('')}
            actions={
              <Button type="submit" square aria-label="Send">
                <ArrowUpIcon aria-hidden="true" className="size-4" />
              </Button>
            }
          />
        </div>
      </Spec>
    </>
  );
}
