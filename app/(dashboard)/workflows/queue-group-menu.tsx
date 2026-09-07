'use client';

/**
 * One flat menu: how to group the list.
 *
 * Deliberately not a filter panel. The earlier version filtered, in
 * three sections and thirteen rows, and reading it took longer than
 * reading the list it was narrowing. Grouping answers the same
 * questions without hiding anything, so there are three rows and no
 * sections.
 *
 * @module app/(dashboard)/workflows/queue-group-menu
 */

import { ChevronDown, Rows3 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { MenuItem, MenuPanel } from '@/components/ui/menu';
import { isChromePress } from '@/components/ui/use-overlay';

import { GROUP_BY_OPTIONS, groupByLabel, type QueueGroupBy } from './queue-grouping';

export interface QueueGroupMenuProps {
  value: QueueGroupBy;
  onChange: (next: QueueGroupBy) => void;
}

/** The Upcoming group-by menu. See {@link QueueGroupMenuProps}. */
export function QueueGroupMenu({ value, onChange }: QueueGroupMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node) && !isChromePress(event.target)) {
        setOpen(false);
      }
    };
    // Escape closes it too: the menu is a view choice, not a decision,
    // and an MC who opened it by mistake should not have to aim at the
    // page to get rid of it.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapperRef}>
      <Button variant="outline" onClick={() => setOpen((wasOpen) => !wasOpen)}>
        <Rows3 size={16} strokeWidth={1.5} />
        {groupByLabel(value)}
        <ChevronDown size={16} strokeWidth={1.5} />
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1">
          <MenuPanel>
            {GROUP_BY_OPTIONS.map((option) => (
              <MenuItem
                key={option.value}
                size="sm"
                selected={value === option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </MenuItem>
            ))}
          </MenuPanel>
        </div>
      ) : null}
    </div>
  );
}
