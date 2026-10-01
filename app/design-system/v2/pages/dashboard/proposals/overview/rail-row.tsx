import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { StretchedButton } from '@/components/ui-v2/stretched-button';
import { Swap } from '@/components/ui-v2/swap';

import { TODAY, monthDay } from '../../payments/dates';
import { coupleName, money } from '../../payments/payments-data';
import { DROPS, canNudge, stopOf } from '../insights';
import { dayWord, type Proposal } from '../proposals-data';
import { PACKAGES, templateOf } from '../templates-data';

/**
 * One row of the Proposals What's next rail, the same shape as a Payments
 * rail row: the date, the couple over what is happening, the value over
 * the package it rides on, then a column of its own for the action. A
 * couple who opened and has not said yes shows Zebri's read of them and
 * gets Nudge (primary: it turns readers into bookings), which opens the
 * proposal with its drafted nudge to read first. A proposal about to
 * expire says so, in amber inside three days, and gets Nudge (secondary)
 * while it is free to nudge. Once nudged today the button hands over to
 * a Nudged tick in place; nudged in the last few days, the column stays
 * empty. Pointing at a row lights the step on the chart the couple
 * stopped at.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/overview/rail-row
 */

/** Why a proposal is on the rail: read and not accepted, or about to expire. */
export type RailKind = 'opened' | 'expiring';

export interface RailRowProps {
  proposal: Proposal;
  kind: RailKind;
  /** Ids nudged this visit. */
  nudged: ReadonlySet<string>;
  /** A Nudge all is on its way, so single nudges wait. */
  busy: boolean;
  /** Opens the proposal; `nudge` opens it with the drafted nudge out. */
  onOpen: (nudge?: boolean) => void;
  /** Lights (a `DROPS` index) or clears (`null`) the row's step on the chart. */
  onFocus: (step: number | null) => void;
}

const left = (n: number) => (n === 0 ? 'expires today' : n === 1 ? 'expires tomorrow' : `expires in ${n} days`);

/** A rail row. See {@link RailRowProps}. */
export function RailRow({ proposal: p, kind, nudged, busy, onOpen, onFocus }: RailRowProps) {
  const opened = kind === 'opened';
  const soon = !opened && (p.expiresIn ?? 0) <= 3;
  const what = opened ? (p.read ?? p.when) : `${templateOf(p.template).name} · ${left(p.expiresIn ?? 0)}`;
  const pkg = PACKAGES[p.chosen ?? p.leaning ?? templateOf(p.template).packages[0]!];
  const found = DROPS.findIndex((d) => d.stop === stopOf(p));
  const step = found < 0 ? null : found;
  const doneToday = p.nudgedOn === TODAY;
  const free = canNudge(p, nudged);
  return (
    <div
      onMouseEnter={() => onFocus(step)}
      onMouseLeave={() => onFocus(null)}
      onFocus={() => onFocus(step)}
      onBlur={() => onFocus(null)}
      className="relative -mx-2 flex cursor-pointer items-center gap-4 rounded-button px-2 py-3 transition-colors duration-150 hover:bg-zebra-950/[0.03] motion-reduce:transition-none"
    >
      <span className="w-14 shrink-0 type-body tabular-nums text-zebra-500">
        {monthDay(opened ? (p.lastOpenedOn ?? p.openedOn!) : p.expiresOn!)}
      </span>
      <div className="min-w-0 flex-1">
        <StretchedButton label={`Open proposal for ${coupleName(p.names)}, ${opened ? p.when : left(p.expiresIn ?? 0)}`} onClick={() => onOpen()}>
          <span className="block truncate type-label text-zebra-950">{coupleName(p.names)}</span>
          <span className={`block truncate type-body ${soon ? 'text-warning-ink' : 'text-zebra-500'}`}>{what}</span>
        </StretchedButton>
      </div>
      <span className="flex flex-col items-end">
        <span className="type-label tabular-nums text-zebra-950">{money(p.value)}</span>
        <span className="type-body text-zebra-400">
          {!doneToday && !free && p.nudgedOn ? `Nudged ${dayWord(p.nudgedOn)}` : pkg.name}
        </span>
      </span>
      {/* Wide enough for the Nudged tick, the widest thing it holds. */}
      <div className="relative z-10 flex w-28 shrink-0 justify-end">
        {doneToday || free ? (
          <Swap
            active={doneToday ? 'done' : 'act'}
            className="justify-items-end"
            states={{
              act: (
                <Button variant={opened ? 'primary' : 'secondary'} disabled={busy} onClick={() => onOpen(true)}>
                  Nudge
                </Button>
              ),
              done: (
                <Badge size="control" tone="brand">
                  <DrawnCheck className="size-3.5" />
                  Nudged
                </Badge>
              ),
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
