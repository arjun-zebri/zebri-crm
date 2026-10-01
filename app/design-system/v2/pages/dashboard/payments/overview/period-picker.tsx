'use client';

import { ArrowLeft, ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { DateRangePicker } from '@/components/ui-v2/date-range-picker';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import { TODAY } from '../dates';
import { PRESETS, rangeLabel, type Range } from '../reports-data';

/**
 * The Overview's period control: a glass button naming the period
 * ("FY 2026–27") that opens a custom menu of the usual periods (both
 * financial years, this and last quarter) and Custom range. Custom range
 * turns the same popover into the v2 `DateRangePicker`: From and To
 * date fields to type into, over a calendar to click a start and an end
 * on, then Apply (off until both ends are set). A custom pick shows on
 * the button as its dates, "1 Aug 2026 to 15 Mar 2027".
 *
 * @module app/design-system/v2/pages/dashboard/payments/overview/period-picker
 */

/** The period control. */
export function PeriodPicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState<Range>(value);
  const preset = PRESETS.find((p) => p.from === value.from && p.to === value.to);
  const pick = (r: Range) => {
    onChange(r);
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // Each opening starts on the list, with the range on screen as the draft.
        if (o) {
          setCustom(false);
          setDraft(value);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="glass" aria-label={`Period: ${rangeLabel(value)}`}>
          {rangeLabel(value)}
          <ChevronDown aria-hidden="true" strokeWidth={1.5} className="size-4 text-zebra-400" />
        </Button>
      </PopoverTrigger>
      {custom ? (
        <PopoverContent size="card" align="end" aria-label="Custom range" className="space-y-3">
          <div className="-ml-2 -mt-1 flex items-center gap-1">
            <Button variant="ghost" square aria-label="Back to periods" onClick={() => setCustom(false)}>
              <ArrowLeft aria-hidden="true" strokeWidth={1.5} className="size-4" />
            </Button>
            <p className="type-label text-zebra-950">Custom range</p>
          </div>
          <DateRangePicker value={draft} onChange={setDraft} today={TODAY} />
          <Button className="w-full" disabled={!draft.from || !draft.to} onClick={() => pick(draft)}>
            Apply
          </Button>
        </PopoverContent>
      ) : (
        <PopoverContent size="menu" align="end" role="menu" aria-label="Period">
          {PRESETS.map((p) => (
            <MenuOption key={p.label} selected={p === preset} onSelect={() => pick(p)}>
              {p.label}
            </MenuOption>
          ))}
          <MenuOption selected={!preset} onSelect={() => setCustom(true)}>
            Custom range
          </MenuOption>
        </PopoverContent>
      )}
    </Popover>
  );
}
