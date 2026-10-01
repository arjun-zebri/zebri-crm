import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { StretchedButton } from '@/components/ui-v2/stretched-button';
import { Swap } from '@/components/ui-v2/swap';

import { dayMonth, monthDay } from '../dates';
import { coupleName, money, waitingOn, type Contract, type Invoice } from '../payments-data';

/**
 * One row of the What's next rail, the same shape as the Proposals
 * rail's: the date, the couple over what it is, the amount over how the
 * money is moving ("Zebri sends 29 Sep", "Sent 24 Sep"), then a column
 * of its own for the action. A late invoice says so in red ("Deposit ·
 * 12 days late"), shows when Zebri last reminded (so the MC never chases
 * twice by accident) and gets Chase (primary: it gets money in); a
 * contract out for signature says who it waits on, with its package
 * under the value, and gets Nudge (secondary). Once done, the button
 * hands over to a Reminded or Nudged tick in place. Rows with nothing to
 * do leave the column empty, so every amount lines up. Pointing at an
 * invoice row lights its month on the chart.
 *
 * @module app/design-system/v2/pages/dashboard/payments/overview/rail-row
 */

/** What a rail row shows. */
export type RailItem = { kind: 'invoice'; invoice: Invoice } | { kind: 'contract'; contract: Contract };

export interface RailRowProps {
  item: RailItem;
  /** The reminder or nudge has gone this visit. */
  done: boolean;
  /** A send from AI insights is on its way, so single actions wait. */
  busy: boolean;
  onOpen: () => void;
  /** Chase (opens the invoice with the drafted reminder) or Nudge (sends it). */
  onAct: () => void;
  /** Lights (month key) or clears (`null`) the row's month on the chart. */
  onFocus: (month: string | null) => void;
}

/** How an invoice's money is moving, under its amount. */
function howOf(i: Invoice, done: boolean) {
  if (i.group === 'overdue') return done ? 'Reminded today' : i.remindedOn ? `Reminded ${dayMonth(i.remindedOn)}` : 'Not reminded yet';
  if (i.zebriSends) return `Zebri sends ${dayMonth(i.zebriSends)}`;
  return i.sentOn ? `Sent ${dayMonth(i.sentOn)}` : null;
}

/** The row's words, worked out once for either kind. */
function read(item: RailItem, done: boolean) {
  if (item.kind === 'contract') {
    const c = item.contract;
    return {
      date: c.sentOn ?? '',
      name: coupleName(c.names),
      what: `${c.title} · waiting on ${waitingOn(c)}`,
      alert: false,
      amount: c.total,
      act: 'Nudge' as const,
      how: c.item,
      open: `Open contract, ${coupleName(c.names)}, waiting on ${waitingOn(c)}`,
    };
  }
  const i = item.invoice;
  const late = i.group === 'overdue';
  return {
    date: i.dueOn,
    name: coupleName(i.names),
    what: late ? `${i.label} · ${i.late} days late` : i.label,
    alert: late,
    amount: i.amount,
    act: late ? ('Chase' as const) : null,
    how: howOf(i, done),
    open: `Open invoice ${i.number}, ${coupleName(i.names)}, ${late ? `${i.late} days late` : `due ${i.due}`}`,
  };
}

/** A rail row. See {@link RailRowProps}. */
export function RailRow({ item, done, busy, onOpen, onAct, onFocus }: RailRowProps) {
  const r = read(item, done);
  const month = item.kind === 'invoice' ? item.invoice.dueOn.slice(0, 7) : null;
  return (
    <div
      onMouseEnter={() => onFocus(month)}
      onMouseLeave={() => onFocus(null)}
      onFocus={() => onFocus(month)}
      onBlur={() => onFocus(null)}
      className="relative -mx-2 flex cursor-pointer items-center gap-4 rounded-button px-2 py-3 transition-colors duration-150 hover:bg-zebra-950/[0.03] motion-reduce:transition-none"
    >
      <span className="w-14 shrink-0 type-body tabular-nums text-zebra-500">{r.date ? monthDay(r.date) : ''}</span>
      <div className="min-w-0 flex-1">
        <StretchedButton label={r.open} onClick={onOpen}>
          <span className="block truncate type-label text-zebra-950">{r.name}</span>
          <span className={`block truncate type-body ${r.alert ? 'text-danger' : 'text-zebra-500'}`}>{r.what}</span>
        </StretchedButton>
      </div>
      <span className="flex flex-col items-end text-right">
        <span className="type-label tabular-nums text-zebra-950">{money(r.amount)}</span>
        {r.how ? <span className="whitespace-nowrap type-body text-zebra-400">{r.how}</span> : null}
      </span>
      {/* Wide enough for the Reminded tick, the widest thing it holds. */}
      <div className="relative z-10 flex w-28 shrink-0 justify-end">
        {r.act ? (
          <Swap
            active={done ? 'done' : 'act'}
            className="justify-items-end"
            states={{
              act: (
                <Button variant={r.act === 'Chase' ? 'primary' : 'secondary'} disabled={busy} onClick={onAct}>
                  {r.act}
                </Button>
              ),
              done: (
                <Badge size="control" tone="brand">
                  <DrawnCheck className="size-3.5" />
                  {r.act === 'Chase' ? 'Reminded' : 'Nudged'}
                </Badge>
              ),
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
