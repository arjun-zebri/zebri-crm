'use client';

import { useState } from 'react';

import { MultiSelect } from '@/components/ui/multi-select';

import { Demo, DemoGrid, Rule, Spec } from './showroom';

/**
 * MultiSelect: the several-values sibling of Select, with every state
 * rendered.
 *
 * @module app/design-system/primitives-multi-select
 */

const STAGES = [
  { value: 'new', label: 'Enquiry' },
  { value: 'confirmed', label: 'Booked' },
  { value: 'lost', label: 'Lost' },
  { value: 'paid', label: 'Paid in full' },
];

/** The MultiSelect spec block, for the form-controls section. */
export function PrimitivesMultiSelect() {
  const [stages, setStages] = useState<string[]>(['lost', 'confirmed']);
  const [empty, setEmpty] = useState<string[]>([]);

  return (
    <Spec
      name="MultiSelect"
      file="components/ui/multi-select.tsx"
      importPath="@/components/ui/multi-select"
      description="Choose any number of values. Same 32px trigger as Select; the choices show as removable chips."
    >
      <Rule>
        Reach for this, not a column of checkboxes and not a hand-built dropdown, whenever a setting
        takes several values from a list. The trigger never grows: it says how many are chosen, and
        the chips under it carry the names, each with its own remove button. A chosen value that is
        no longer an option keeps its chip, labelled by the raw value, so it can still be removed.
      </Rule>
      <DemoGrid cols={3}>
        <Demo label="With choices">
          <MultiSelect
            label="Stop when the couple moves to"
            options={STAGES}
            value={stages}
            onValueChange={setStages}
          />
        </Demo>
        <Demo label="Empty, with help">
          <MultiSelect
            label="Stages"
            options={STAGES}
            value={empty}
            onValueChange={setEmpty}
            placeholder="No stages"
            help="Pick as many as you like."
          />
        </Demo>
        <Demo label="Error">
          <MultiSelect
            label="Stages"
            options={STAGES}
            value={['lost']}
            onValueChange={() => {}}
            error="This workflow starts on Lost, so it cannot also stop then."
          />
        </Demo>
        <Demo label="Disabled (saving)">
          <MultiSelect label="Stages" options={STAGES} value={['paid']} onValueChange={() => {}} disabled />
        </Demo>
      </DemoGrid>
    </Spec>
  );
}
