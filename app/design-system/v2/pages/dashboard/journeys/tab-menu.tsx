'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ChevronDownIcon } from '@/components/ui-v2/icons';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import { Segmented } from '@/components/ui-v2/segmented';

/**
 * The step dialog's switch between what the client gets (the document,
 * its email, each reminder). Up to three fit as a segmented control;
 * past that the labels wrapped onto two lines in the track (founder,
 * 2026-10-08), so it becomes one dropdown naming the picked one, with
 * every option in its menu.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/tab-menu
 */

/** The most that sit side by side before it turns into a dropdown. */
const MOST = 3;

export interface TabMenuProps {
  label: string;
  tabs: string[];
  labels: Record<string, string>;
  value: string;
  onChange: (tab: string) => void;
}

/** The switch. See {@link TabMenuProps}. */
export function TabMenu({ label, tabs, labels, value, onChange }: TabMenuProps) {
  const [open, setOpen] = useState(false);
  if (tabs.length < 2) return null;
  if (tabs.length <= MOST) return <Segmented label={label} options={tabs} labels={labels} value={value} onChange={onChange} />;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" aria-label={`${label}: ${labels[value]}. Change`}>
          {labels[value]}
          <ChevronDownIcon aria-hidden="true" className="size-4 text-zebra-500" />
        </Button>
      </PopoverTrigger>
      <PopoverContent size="menu" align="start" role="menu" aria-label={label}>
        {tabs.map((t) => (
          <MenuOption key={t} selected={t === value} onSelect={() => (setOpen(false), onChange(t))}>
            {labels[t]}
          </MenuOption>
        ))}
      </PopoverContent>
    </Popover>
  );
}
