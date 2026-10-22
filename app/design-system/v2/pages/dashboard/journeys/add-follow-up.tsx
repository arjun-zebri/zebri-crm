'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ArrowLeftIcon, PlusIcon } from '@/components/ui-v2/icons';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import type { RelTime } from '../../../relative-time/model';
import { RelativeTimePicker } from '../../../relative-time/relative-time-picker';

import { span } from './timing';

/**
 * Add, beside a step's Follow-ups label: a popover that asks which kind (Remind
 * them, Tell me), then how long after the step goes out on a second page
 * of the same popover: the design system's relative time picker, typed
 * or one of four usual spans. It hands back the follow-up as its words
 * ("Remind them after 3 days").
 *
 * @module app/design-system/v2/pages/dashboard/journeys/add-follow-up
 */

export const KINDS = { remind: 'Remind them', tell: 'Tell me' } as const;

type FollowKind = keyof typeof KINDS;

/** A follow-up only counts from the step going out, so every span is "after". */
const after = (amount: number, unit: 'days' | 'weeks'): RelTime => ({ anchor: 'previous', amount, unit });

const USUAL: RelTime[] = [after(1, 'days'), after(3, 'days'), after(1, 'weeks'), after(2, 'weeks')];

/** A span as a chip reads: "3 days". */
const spanOf = (t: RelTime) => (t.anchor === 'manual' ? '' : span(t.amount, t.unit));

export interface AddFollowUpProps {
  onAdd: (item: string) => void;
}

/** The button and its popover. See {@link AddFollowUpProps}. */
export function AddFollowUp({ onAdd }: AddFollowUpProps) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FollowKind | null>(null);
  const add = (k: FollowKind, t: RelTime) => {
    if (t.anchor === 'manual') return;
    setOpen(false);
    setKind(null);
    onAdd(`${KINDS[k]} after ${span(t.amount, t.unit)}`);
  };
  return (
    <Popover open={open} onOpenChange={(o) => (setOpen(o), setKind(null))}>
      <PopoverTrigger asChild>
        <Button variant="ghost" compact aria-label="Add a follow-up" icon={<PlusIcon aria-hidden="true" className="size-4" />} className="-mr-2">
          Add
        </Button>
      </PopoverTrigger>
      <PopoverContent
        size="menu"
        align="end"
        role={kind ? 'dialog' : 'menu'}
        aria-label="Add a follow-up"
      >
        {kind ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Button variant="ghost" square aria-label="Back" onClick={() => setKind(null)}>
                <ArrowLeftIcon aria-hidden="true" className="size-4" />
              </Button>
              <p className="type-label text-zebra-950">{KINDS[kind]} after</p>
            </div>
            <RelativeTimePicker
              anchors={['previous']}
              now={false}
              manual={false}
              quick={USUAL}
              short={spanOf}
              placeholder="Type a time"
              onChange={(t) => add(kind, t)}
            />
          </div>
        ) : (
          (Object.keys(KINDS) as FollowKind[]).map((k) => (
            <MenuOption key={k} onSelect={() => setKind(k)}>
              {KINDS[k]}
            </MenuOption>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}
