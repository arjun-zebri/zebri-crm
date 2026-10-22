'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { CalendarField } from '@/components/ui-v2/calendar-field';
import { ComboField } from '@/components/ui-v2/combo-field';
import { EmailIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';

import { Spec } from './showroom-v2';

/**
 * v2 boxed fields, for forms a stranger fills in once (the entry screens,
 * the couple's BDM form): Input `boxed` with its optional mark, CalendarField
 * and ComboField. Client-side for the live demos.
 *
 * @module app/design-system/v2/components-forms-boxed
 */

const COUNTRIES = ['Australia', 'Canada', 'Fiji', 'India', 'Ireland', 'New Zealand', 'Philippines', 'South Africa', 'United Kingdom', 'United States'];

/** The boxed fields' entries. */
export function ComponentsFormsBoxedV2() {
  const [dob, setDob] = useState('');
  const [country, setCountry] = useState('');
  return (
    <>
      <Spec
        name="Boxed fields"
        file="components/ui-v2/boxed-label.tsx"
        description="Input, DateField and Dropdown `boxed`, and ChipGroup `stacked`: the name over a white hairline box 40px tall, a step taller than the app's 36px, with help shown under it. Only where a stranger fills a form in once (log in, sign up, the couple's BDM form). There, `optional` adds a grey (optional) after the name, as GOV.UK does; required fields stay unmarked, and inside the app nothing is marked."
      >
        <div className="grid max-w-xl gap-x-3 gap-y-5 sm:grid-cols-2">
          <Input boxed label="First given name" defaultValue="Arjun" />
          <Input boxed optional label="Other given names" />
          <div className="sm:col-span-2">
            <Input boxed label="Street address" help={'No commas or slashes: "Unit 4 12 Smith Street".'} />
          </div>
        </div>
      </Spec>
      <Spec
        name="Boxed field with a button"
        file="components/ui-v2/input.tsx"
        description="Input `boxed` with `trailing` and `trailingWide`: a labelled button inside the box's right edge, the box 48px tall so the button sits 6px in all round, the text stopping short of it. `labelHidden` keeps the name for screen readers only, for a lone field the words around it already explain. The marketing hero's email capture."
      >
        <div className="max-w-md">
          <Input
            boxed
            labelHidden
            icon={EmailIcon}
            label="Email"
            type="email"
            placeholder="you@example.com"
            trailing={<Button>Get early access</Button>}
            trailingWide
          />
        </div>
      </Spec>
      <Spec
        name="Calendar field"
        file="components/ui-v2/calendar-field.tsx"
        description="A boxed date, typed first: the box is DD / MM / YYYY, each part its own stop (date-segments.tsx), moving on as a part fills; arrows step a part, a pasted date fills all three. The calendar button opens Zebri's calendar (date-panel.tsx), the month and the year as quiet menus in its header. For a birthday set max to today and openYear to about 1990."
      >
        <div className="max-w-xs">
          <CalendarField label="Date of birth" value={dob} onChange={setDob} openYear={1990} max="2026-10-15" />
        </div>
      </Spec>
      <Spec
        name="Combo field"
        file="components/ui-v2/combo-field.tsx"
        description="A boxed pick-one for a long list (the countries), typed to narrow it: options starting with what is typed first, then any containing it. Arrow keys move, Enter picks, Escape puts the last pick back. `pinned` options lead the list under a rule while nothing is typed. A boxed Dropdown of more than twelve options on the couple's form becomes one."
      >
        <div className="max-w-sm">
          <ComboField label="Country you were born in" options={COUNTRIES} pinned={['Australia']} value={country} onChange={setCountry} />
        </div>
      </Spec>
    </>
  );
}
