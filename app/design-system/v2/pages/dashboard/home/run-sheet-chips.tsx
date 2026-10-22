'use client';

import { useState } from 'react';

import { PlusIcon } from '@/components/ui-v2/icons';
import { InlineInput } from '@/components/ui-v2/inline-input';
import { MenuOption } from '@/components/ui-v2/popover';
import { PropertyChip } from '@/components/ui-v2/property-chip';

import { addStatus, addVendorType, useStatuses, useVendorTypes } from './run-sheet-store';
import { lengthOf } from './run-sheets';

/**
 * A run sheet moment's chips, as New client's details are: who runs it
 * (the supplier types), where it stands (To confirm, Confirmed, …) and
 * how long it takes. Who and Status end with a line to type one that is
 * missing, kept for every sheet after. No icons and no fill: plain words,
 * tinted only when pointed at. Picking the current one again clears it.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheet-chips
 */

interface PickOrAddProps {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  /** Keeps a typed option and returns it as kept. */
  onAdd: (name: string) => string;
  /** The add line's placeholder: "Add a type". */
  addLabel: string;
}

/** A quiet chip whose menu ends with a line to add an option of one's own. */
function PickOrAddChip({ label, options, value, onChange, onAdd, addLabel }: PickOrAddProps) {
  const [open, setOpen] = useState(false);
  const [own, setOwn] = useState('');
  const pick = (option: string) => {
    onChange(value === option ? '' : option);
    setOpen(false);
  };
  return (
    <PropertyChip
      quiet
      label={label}
      value={value || undefined}
      open={open}
      onOpenChange={setOpen}
      size="menu"
    >
      {options.map((o) => (
        <MenuOption key={o} selected={value === o} onSelect={() => pick(o)}>
          {o}
        </MenuOption>
      ))}
      {/* The last line is the field: one boxless line to type a new one
          on, led by a plus, as New client's venue chip is. */}
      <form
        className="flex h-8 items-center gap-2 px-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!own.trim()) return;
          pick(onAdd(own));
          setOwn('');
        }}
      >
        <PlusIcon aria-hidden="true" className="size-4 shrink-0 text-zebra-400" />
        <InlineInput
          aria-label={addLabel}
          placeholder={addLabel}
          autoComplete="off"
          value={own}
          onChange={(e) => setOwn(e.target.value)}
          className="min-w-0 flex-1 type-body"
        />
      </form>
    </PropertyChip>
  );
}

/** Who runs a moment. */
export function WhoChip({ value, onChange }: { value: string; onChange: (owner: string) => void }) {
  return (
    <PickOrAddChip
      label="Who"
      options={useVendorTypes()}
      value={value}
      onChange={onChange}
      onAdd={addVendorType}
      addLabel="Add a type"
    />
  );
}

/** Where a moment stands. */
export function StatusChip({
  value,
  onChange,
}: {
  value: string;
  onChange: (status: string) => void;
}) {
  return (
    <PickOrAddChip
      label="Status"
      options={useStatuses()}
      value={value}
      onChange={onChange}
      onAdd={addStatus}
      addLabel="Add a status"
    />
  );
}

const LENGTHS = [5, 10, 15, 20, 30, 40, 45, 60, 75, 90, 120, 150];

/** How long a moment takes. */
export function LengthChip({
  value,
  onChange,
}: {
  value: number;
  onChange: (minutes: number) => void;
}) {
  const [open, setOpen] = useState(false);
  // The moment's own length stays on the list even when it is not a usual one.
  const lengths = LENGTHS.includes(value) ? LENGTHS : [...LENGTHS, value].sort((a, b) => a - b);
  return (
    <PropertyChip
      quiet
      label="Length"
      value={lengthOf(value)}
      open={open}
      onOpenChange={setOpen}
      size="menu"
    >
      <div className="max-h-64 overflow-y-auto">
        {lengths.map((n) => (
          <MenuOption key={n} selected={n === value} onSelect={() => (onChange(n), setOpen(false))}>
            {lengthOf(n)}
          </MenuOption>
        ))}
      </div>
    </PropertyChip>
  );
}
