'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ColorField } from '@/components/ui-v2/color-field';
import { TrashIcon } from '@/components/ui-v2/icons';
import { InlineInput } from '@/components/ui-v2/inline-input';
import { Textarea } from '@/components/ui-v2/textarea';
import { TimeField } from '@/components/ui-v2/time-field';

import { LengthChip, StatusChip, WhoChip } from './run-sheet-chips';
import { BLOCK_DEFAULT, BLOCK_SWATCHES } from './run-sheet-edges';
import { startText, type Slot } from './run-sheet-schedule';
import { minutesOf, type Moment } from './run-sheets';

/**
 * The moment picked on the day, in the side panel: its name as the
 * heading (with a quiet bin beside it), then when, how long, who runs
 * it, where it stands and its colour, each edited where it reads, and below them a large
 * notes area for everything the MC needs on the mic, questions for the
 * couple included. A new time moves the moment to its place in the
 * night (`onTime`); every other change goes straight back through
 * `onChange`.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheet-detail
 */

export interface RunSheetDetailProps {
  moment: Moment;
  slot: Slot | undefined;
  /** When the moment before ends, so a bare hour typed reads as the time after it. */
  after?: number | undefined;
  onChange: (patch: Partial<Moment>) => void;
  /** A new start, in minutes after midnight. */
  onTime: (start: number) => void;
  onRemove: () => void;
}

/** One line of the list: what it is on the left, the value to edit on the right. */
function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-9 grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-3">
      <dt className="pt-2 type-body text-zebra-500">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** The moment's detail. See {@link RunSheetDetailProps}. */
export function RunSheetDetail({
  moment: m,
  slot,
  after,
  onChange,
  onTime,
  onRemove,
}: RunSheetDetailProps) {
  const name = m.moment || 'this moment';
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <InlineInput
          aria-label="Moment"
          placeholder="What happens"
          // A moment just added has no name yet: that is the first thing to give it.
          autoFocus={!m.moment}
          value={m.moment}
          onChange={(e) => onChange({ moment: e.target.value })}
          className="min-w-0 flex-1 type-title"
        />
        <Button
          variant="ghost"
          square
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          className="-mr-2 text-zebra-400"
        >
          <TrashIcon aria-hidden="true" className="size-4" />
        </Button>
      </div>
      <dl className="space-y-1">
        <Prop label="Time">
          <TimeField
            aria-label={`Time of ${name}`}
            value={m.time || startText(slot)}
            muted={!m.time}
            after={after}
            onChange={(time) => {
              const start = minutesOf(time, after);
              // Picking the time it already has keeps it following on.
              if (start !== null && start !== slot?.start) onTime(start);
            }}
            className="w-24 pt-2 type-body"
          />
        </Prop>
        <Prop label="Length">
          <span className="-ml-2.5 mt-0.5 inline-flex">
            <LengthChip value={m.minutes} onChange={(minutes) => onChange({ minutes })} />
          </span>
        </Prop>
        <Prop label="Who">
          <span className="-ml-2.5 mt-0.5 inline-flex">
            <WhoChip value={m.owner} onChange={(owner) => onChange({ owner })} />
          </span>
        </Prop>
        <Prop label="Status">
          <span className="-ml-2.5 mt-0.5 inline-flex">
            <StatusChip
              value={m.status ?? ''}
              onChange={(status) => onChange({ status: status || undefined })}
            />
          </span>
        </Prop>
        <Prop label="Colour">
          <div className="mt-0.5">
            <ColorField
              bare
              label={`Colour of ${name}`}
              value={m.color ?? BLOCK_DEFAULT}
              swatches={BLOCK_SWATCHES}
              onChange={(color) => onChange({ color })}
            />
          </div>
        </Prop>
      </dl>
      {/* Room to write: a song, who speaks and in what order, a name to say right, what to ask the couple.
          No heading over it: the placeholder names it, as New client's notes do. */}
      <Textarea
        bare
        grow
        rows={8}
        aria-label={`Notes for ${name}`}
        placeholder="Notes: a song, who speaks, a name to say right, anything to ask the couple"
        value={m.cue}
        onChange={(e) => onChange({ cue: e.target.value })}
        className="min-h-48"
      />
    </div>
  );
}
