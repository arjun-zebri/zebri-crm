'use client';

import { useState } from 'react';

import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import { BarMenuButton } from './bar-parts';

/**
 * The bar's menus that say their choices in words (founder, 2026-10-21:
 * icons for "words beside the logo" did not read): `PickMenu`, one choice
 * of several, closing on a pick (a header's Layout, who signs); and
 * `ShowMenu`, lines to show or hide, several on at once, so it stays open
 * as each is turned on or off (a signing place's name and date, an
 * invoice's GST breakdown).
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/section-bar/word-menus
 */

/** One choice in a menu. */
export interface MenuChoice<T extends string> {
  value: T;
  label: string;
}

/** One of several, named on the bar by `label`. */
export function PickMenu<T extends string>({ label, choices, value, onPick }: { label: string; choices: readonly MenuChoice<T>[]; value: T; onPick: (v: T) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <BarMenuButton label={label} on={open}>
          {label}
        </BarMenuButton>
      </PopoverTrigger>
      <PopoverContent size="menu" side="bottom" align="start" aria-label={label}>
        {choices.map((c) => (
          <MenuOption key={c.value} selected={c.value === value} onSelect={() => (onPick(c.value), setOpen(false))}>
            {c.label}
          </MenuOption>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** Lines to show, each on or off: `on` says which are. */
export function ShowMenu<K extends string>({ lines, on, onToggle }: { lines: readonly { key: K; label: string }[]; on: Record<K, boolean>; onToggle: (key: K) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <BarMenuButton label="Show" on={open}>
          Show
        </BarMenuButton>
      </PopoverTrigger>
      <PopoverContent size="menu" side="bottom" align="start" aria-label="Show">
        {lines.map((l) => (
          <MenuOption key={l.key} multiple selected={on[l.key]} onSelect={() => onToggle(l.key)}>
            {l.label}
          </MenuOption>
        ))}
      </PopoverContent>
    </Popover>
  );
}
