'use client';

import * as Popover from '@radix-ui/react-popover';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { MenuItem, MenuPanel } from '@/components/ui/menu';
import { QUESTION_PRESETS, type QuestionPreset } from '@/lib/booking/question-presets';

interface BookingPresetMenuProps {
  /** Disables the trigger, e.g. when the list is already full. */
  disabled?: boolean;
  /** Called with the chosen preset. The menu closes itself first. */
  onPick: (preset: QuestionPreset) => void;
}

/**
 * "Add a preset" dropdown listing the starter question sets.
 *
 * Built on the shared `MenuPanel` and `MenuItem` so its rows match every other
 * dropdown in the app. Positioning comes from Radix, which the row actions
 * menu also uses.
 *
 * @module app/(dashboard)/calendar/booking-preset-menu
 */
export function BookingPresetMenu({ disabled = false, onPick }: BookingPresetMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="secondary" disabled={disabled}>
          <Sparkles size={16} strokeWidth={1.5} />
          Add a preset
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} className="z-[80]">
          <MenuPanel>
            {QUESTION_PRESETS.map((preset) => (
              <MenuItem
                key={preset.id}
                onClick={() => {
                  setOpen(false);
                  onPick(preset);
                }}
              >
                {preset.label}
              </MenuItem>
            ))}
          </MenuPanel>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
