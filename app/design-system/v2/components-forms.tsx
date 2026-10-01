'use client';

import { ArrowUp } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Checkbox } from '@/components/ui-v2/checkbox';
import { Dropdown } from '@/components/ui-v2/dropdown';
import { InlineInput } from '@/components/ui-v2/inline-input';
import { Input } from '@/components/ui-v2/input';
import { PasswordInput } from '@/components/ui-v2/password-input';
import { PromptBox } from '@/components/ui-v2/prompt-box';
import { Switch } from '@/components/ui-v2/switch';
import { TextLink } from '@/components/ui-v2/text-link';
import { Textarea } from '@/components/ui-v2/textarea';

import { DemoRow, Group, Spec } from './showroom-v2';

/**
 * v2 inputs: every field state side by side (resting, helped, errored,
 * disabled), the boxless inline input, checkbox, switch and the prompt
 * box. Client-side for the switch and prompt demos.
 *
 * @module app/design-system/v2/components-forms
 */
export function ComponentsFormsV2() {
  const [live, setLive] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [unit, setUnit] = useState('days');
  return (
    <Group id="inputs" title="Inputs">
      <Spec
        name="Input, Password, Textarea"
        file="components/ui-v2/input.tsx"
        description="Every text field sits in the shared Field (components/ui-v2/field.tsx): label, optional mark, help and error, all in body size. Focus turns the border grass green with a soft halo. Textareas never resize by hand; rows sets their size for the job, or `fill` stretches one to the height of its column (the notes pad beside a video call). `bare` drops the box, so notes sit on the page like a document (New client's notes under the name and chips)."
      >
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <Input label="Email" type="email" placeholder="you@example.com" />
          <Input label="Business name" optional placeholder="Your business name" help="Shown on proposals and invoices." />
          <Input label="Email" type="email" defaultValue="sophie@" error="Enter a valid email address." />
          <Input label="Venue" defaultValue="Stones of the Yarra Valley" disabled />
          <PasswordInput label="Password" placeholder="At least 8 characters" labelAside={<TextLink href="#inputs">Forgot?</TextLink>} />
          <Textarea label="Notes" optional placeholder="Anything to remember about the couple" help="Only you can see these." />
          <Textarea bare aria-label="Notes" placeholder="Notes: what they're after, how you met, anything to remember" />
          <Input
            label="Due in"
            inputMode="numeric"
            defaultValue="7"
            help="A number with its unit: trailing plus trailingWide, an inline Dropdown inside."
            trailingWide
            trailing={<Dropdown inline label="Unit" value={unit} onChange={setUnit} options={['days', 'weeks', 'months'].map((u) => ({ value: u, label: u }))} />}
          />
        </div>
      </Spec>
      <Spec
        name="Inline input"
        file="components/ui-v2/inline-input.tsx"
        description="Boxless, for a form that reads as a document. It takes the type role of the line it sits in; underline marks a value inside a sentence."
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <InlineInput aria-label="Package name" placeholder="Package name" defaultValue="Ceremony only" className="flex-1 type-heading" />
            <InlineInput aria-label="Price in dollars" inputMode="numeric" placeholder="0" defaultValue="900" className="w-24 text-right type-heading tabular-nums" />
          </div>
          <p className="flex items-baseline gap-x-2 type-lead text-zebra-700">
            Couples pay
            <InlineInput aria-label="Deposit percent" underline suffix="%" inputMode="numeric" defaultValue="25" className="type-lead text-zebra-950" />
            to lock in their date.
          </p>
        </div>
      </Spec>
      <Spec name="Checkbox & switch" file="components/ui-v2/checkbox.tsx" description="A checkbox for a choice made on submit; a switch for a setting that takes effect at once.">
        <DemoRow>
          <Checkbox label="Send me a copy" />
          <Checkbox label="Remind me the day before" defaultChecked />
          <Checkbox label="Unavailable" disabled />
          <label className="flex items-center gap-3 type-body text-zebra-950">
            <Switch checked={live} onChange={setLive} aria-label="Intro call bookable" />
            Intro call {live ? 'is live' : 'is paused'}
          </label>
        </DemoRow>
      </Spec>
      <Spec
        name="Prompt box"
        file="components/ui-v2/prompt-box.tsx"
        description="The Ask Zebri composer: a lead-size text area that grows with its text, tools on the left of its toolbar, actions on the right. Enter sends, Shift+Enter breaks the line."
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
                <ArrowUp aria-hidden="true" strokeWidth={1.5} className="size-4" />
              </Button>
            }
          />
        </div>
      </Spec>
    </Group>
  );
}
