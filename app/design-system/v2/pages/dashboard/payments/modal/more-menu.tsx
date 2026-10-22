'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { MoreIcon } from '@/components/ui-v2/icons';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

/**
 * The More menu in a document dialog's header (an invoice, a contract, a
 * proposal): a ghost square opening the rarer moves. Controlled, so a
 * pick runs and the menu closes; a destructive move (Void, Delete,
 * Withdraw) says so with `danger` and shows in red.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/more-menu
 */

/** One move in the menu. */
export interface MoreItem {
  label: string;
  run: () => void;
  danger?: boolean | undefined;
}

/** The More menu. */
export function MoreMenu({ items }: { items: MoreItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" square aria-label="More">
          <MoreIcon aria-hidden="true" className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent size="menu" align="end" role="menu" aria-label="More">
        {items.map((item) => (
          <MenuOption
            key={item.label}
            onSelect={() => {
              item.run();
              setOpen(false);
            }}
          >
            <span className={item.danger ? 'text-danger' : undefined}>{item.label}</span>
          </MenuOption>
        ))}
      </PopoverContent>
    </Popover>
  );
}
