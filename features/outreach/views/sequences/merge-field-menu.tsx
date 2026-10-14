'use client';

/**
 * "Insert field" menu: lists every merge field in plain words and hands
 * the chosen one back to the editor, which inserts it into the message.
 *
 * @module features/outreach/views/sequences/merge-field-menu
 */
import * as Popover from '@radix-ui/react-popover';
import { Braces } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { MenuItem, MenuLabel, MenuPanel } from '@/components/ui/menu';
import { MERGE_FIELDS, type MergeField } from '@/lib/outreach/render';

import { FIELD_LABELS } from './merge-fields';

interface MergeFieldMenuProps {
  /** Called with the field the founder picked. */
  onPick: (field: MergeField) => void;
  /** Which message the field goes into, e.g. "Step 1, variant A". */
  targetLabel: string;
}

/** Popover of merge fields. The editor decides where the token lands. */
export function MergeFieldMenu({ onPick, targetLabel }: MergeFieldMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="outline" aria-label="Insert merge field">
          <Braces size={16} strokeWidth={1.5} aria-hidden="true" />
          Insert field
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="z-[70]" sideOffset={4} align="end">
          <MenuPanel width="lg">
            <MenuLabel>Insert into {targetLabel}</MenuLabel>
            {MERGE_FIELDS.map((field) => (
              <MenuItem
                key={field}
                onClick={() => {
                  onPick(field);
                  setOpen(false);
                }}
                trailing={<span className="text-text-subtle">{`{{${field}}}`}</span>}
              >
                {FIELD_LABELS[field]}
              </MenuItem>
            ))}
          </MenuPanel>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
