'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

/**
 * A ghost button under the reply that opens a short menu of things to
 * drop into it (a booking type, a proposal template). Picking one hands
 * its line to `onPick`; the menu portals into the open dialog.
 *
 * @module app/design-system/v2/pages/dashboard/enquiries/insert-menu
 */

export interface InsertMenuProps {
  label: string;
  icon: ZebriIcon;
  options: readonly { id: string; label: string; line: string }[];
  onPick: (line: string) => void;
  disabled?: boolean | undefined;
}

/** The insert button and its menu. See {@link InsertMenuProps}. */
export function InsertMenu({ label, icon: Icon, options, onPick, disabled }: InsertMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" disabled={disabled} icon={<Icon aria-hidden="true" className="size-4" />}>
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent size="menu" align="start" role="menu" aria-label={label}>
        {options.map((o) => (
          <MenuOption
            key={o.id}
            onSelect={() => {
              onPick(o.line);
              setOpen(false);
            }}
          >
            {o.label}
          </MenuOption>
        ))}
      </PopoverContent>
    </Popover>
  );
}
