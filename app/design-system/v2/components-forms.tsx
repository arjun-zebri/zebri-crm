'use client';

import { useState } from 'react';

import { CardField } from '@/components/ui-v2/card-field';
import { Dropdown } from '@/components/ui-v2/dropdown';
import { Field } from '@/components/ui-v2/field';
import { BriefcaseIcon, EmailIcon, HeartIcon, HourglassIcon, LockIcon, SearchIcon, VenueIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { PasswordInput } from '@/components/ui-v2/password-input';
import { Select } from '@/components/ui-v2/select';
import { TextLink } from '@/components/ui-v2/text-link';
import { Textarea } from '@/components/ui-v2/textarea';

import { ComponentsFormsBoxedV2 } from './components-forms-boxed';
import { ComponentsFormsMoreV2 } from './components-forms-more';
import { Demo, DemoRow, Group, Spec } from './showroom-v2';

/**
 * v2 inputs, each primitive in its own entry: Field (option G, the
 * icon-led fitted field, empty beside filled), Input, PasswordInput, Textarea, Select and
 * CardField here; the boxless and toggle controls in
 * `components-forms-more.tsx`. Client-side for the live demos.
 *
 * @module app/design-system/v2/components-forms
 */
export function ComponentsFormsV2() {
  const [unit, setUnit] = useState('days');
  const [card, setCard] = useState({ number: '', expiry: '', cvc: '' });
  const [name, setName] = useState('');
  return (
    <Group id="inputs" title="Inputs">
      <Spec
        name="Field"
        file="components/ui-v2/field.tsx"
        description="Option G, the one way a v2 text field looks: a line led by the field's icon, then the words themselves. Empty, the words are the field's name in grey, as the placeholder; filled, the value in black, and the icon keeps saying what it is. All one size, no box, no border, no label above. Hovering tints exactly the words, so the tint hugs the placeholder or the value and grows as you type; clicking in clears it and leaves the caret. Field is the wrapper behind it: the name for screen readers, then help and error under the words, indented past the icon. A question is too long to sit in a field, so it shows above and the field prompts 'Your answer'. Nothing is marked optional."
      >
        <DemoRow>
          <Demo label="Empty: the name is the placeholder" className="w-64">
            <Input icon={VenueIcon} label="Venue" value={name} onChange={(e) => setName(e.target.value)} />
          </Demo>
          <Demo label="Filled: the icon says what the value is" className="w-64">
            <Input icon={VenueIcon} label="Venue" defaultValue="Stones of the Yarra Valley" />
          </Demo>
          <Demo label="A question keeps its label" className="w-64">
            <Input icon={HeartIcon} label="Where did you meet?" />
          </Demo>
          <Demo label="Wrapping a custom control" className="w-64">
            <Field id="field-demo" label="Guests" help="Field wraps any control.">
              <input id="field-demo" defaultValue="120" className="block w-full bg-transparent type-body text-zebra-950 outline-none" />
            </Field>
          </Demo>
        </DemoRow>
      </Spec>
      <Spec
        name="Input"
        file="components/ui-v2/input.tsx"
        description="A one-line option G field: `icon` leads the row and `label` is the grey placeholder and the accessible name, never a label above. Fitted to its words, so the hover tint hugs them; `wide` stretches a long value (a subject line, a link) to the row. Focus is the caret only, never an outline. Help and error sit under the words and both describe it; the words never turn red. `raised` is the toolbar look (white, the panel's corners, beside raised buttons); `filled` a grey well for a search heading a dialog's rail; `trailing` with `trailingWide` holds a unit picker."
      >
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <Input icon={BriefcaseIcon} label="Business name" help="Shown on proposals and invoices." />
          <Input icon={EmailIcon} label="Email" type="email" defaultValue="sophie@" error="Enter a valid email address." />
          <Input icon={VenueIcon} label="Venue" defaultValue="Stones of the Yarra Valley" disabled />
          <Input
            icon={HourglassIcon}
            label="Due in"
            inputMode="numeric"
            defaultValue="7"
            trailingWide
            trailing={
              <Dropdown
                inline
                label="Unit"
                value={unit}
                onChange={setUnit}
                options={['days', 'weeks', 'months'].map((u) => ({ value: u, label: u }))}
              />
            }
          />
          <Input aria-label="Search clients" placeholder="Search" raised leading={<SearchIcon className="size-4" />} />
          <Input aria-label="Search blocks" placeholder="Search" filled leading={<SearchIcon className="size-4" />} />
        </div>
      </Spec>
      <Spec
        name="Password input"
        file="components/ui-v2/password-input.tsx"
        description="An option G Input (led by the lock) with a show and hide toggle after the words: a real button with aria-pressed and a name that changes, taking the focus mark."
      >
        <div className="max-w-sm">
          <PasswordInput icon={LockIcon} label="Password" labelAside={<TextLink href="#inputs">Forgot?</TextLink>} />
        </div>
      </Spec>
      <Spec
        name="Textarea"
        file="components/ui-v2/textarea.tsx"
        description="The multi-line Input, fitted the same way: `label` is the grey placeholder, no label above, the hover tint on the words, cleared on click. Never resized by hand: rows sets its size for the job, `fill` stretches it to its column, `grow` grows it with what is typed, and `bare` drops the Field so notes sit on the page like a document (New client's notes)."
      >
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <Textarea label="Notes" help="Only you can see these." />
          <Textarea bare aria-label="Notes" placeholder="Notes: what they're after, how you met, anything to remember" />
        </div>
      </Spec>
      <Spec
        name="Select"
        file="components/ui-v2/select.tsx"
        description="The platform select, fitted like an option G field: the words (the name in grey until picked, then the value) with a chevron, the hover tint hugging them, no label above. The best picker on phones, keyboard and screen readers for free, but it takes no icon: in a form prefer Dropdown with an `icon`. `filled` keeps a set value reading as a field."
      >
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <Select label="Heading font" options={['Inter', 'Fraunces']} defaultValue="Inter" />
          <Select label="Celebrant code" filled options={['A', 'C', 'G']} defaultValue="A" />
        </div>
      </Spec>
      <Spec
        name="Card field"
        file="components/ui-v2/card-field.tsx"
        description="A payment card as one control: number, expiry and CVC on one line, the card brands at the right until a number is typed, grouping and slashing itself as it is typed (the plan sheet). Text entry, so no focus mark."
      >
        <div className="max-w-md">
          <CardField value={card} onChange={setCard} />
        </div>
      </Spec>
      <ComponentsFormsBoxedV2 />
      <ComponentsFormsMoreV2 />
    </Group>
  );
}
