import { Avatar } from '@/components/ui-v2/avatar';
import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { StretchedButton } from '@/components/ui-v2/stretched-button';
import { Swap } from '@/components/ui-v2/swap';

import { coupleName, money, type Invoice } from './payments-data';

/**
 * One invoice row: the couple and which payment it is, the amount, and
 * when it is due (or was paid). Overdue rows end in Send reminder, a
 * secondary button (the section already says it is late), which opens
 * the invoice with Zebri's drafted reminder; once sent it hands over to
 * a "Reminded" tick in place. Clicking anywhere else on the row opens
 * the invoice. On phones the parts stack; from `lg` they line up in
 * fixed columns.
 *
 * @module app/design-system/v2/pages/dashboard/payments/invoice-row
 */

/**
 * Both partners' initials, the second tucked behind the first: the
 * front circle is ringed and painted on top, the one behind a shade
 * deeper, so the pair reads as one couple, not as two loose letters.
 */
export function CoupleAvatars({ names }: { names: [string, string] }) {
  return (
    // Reversed so the front partner comes later in the DOM and paints on
    // top without a z-index, which would lift it over the row's stretched
    // click area and make the avatars dead to clicks.
    <span className="flex shrink-0 flex-row-reverse">
      {/* One avatar for a client who is one person. */}
      {names[1] ? <Avatar name={names[1]} tone="shade" className="-ml-2" /> : null}
      <Avatar name={names[0]} tone="soft" className="ring-2 ring-field" />
    </span>
  );
}

export const ROW =
  'relative grid cursor-pointer gap-x-10 gap-y-1 rounded-button px-3 py-4 transition-colors duration-150 hover:bg-zebra-950/[0.03] motion-reduce:transition-none';

export interface InvoiceRowProps {
  invoice: Invoice;
  reminded: boolean;
  onOpen: () => void;
  onRemind: () => void;
}

/** An invoice row. See {@link InvoiceRowProps}. */
export function InvoiceRow({ invoice: i, reminded, onOpen, onRemind }: InvoiceRowProps) {
  const late = i.group === 'overdue';
  return (
    <li>
      <div className={`${ROW} grid-cols-[minmax(0,1fr)_auto] items-center lg:grid-cols-[minmax(0,1fr)_7rem_10rem_9.5rem]`}>
        <div className="flex min-w-0 items-center gap-3">
          <CoupleAvatars names={i.names} />
          <StretchedButton label={`Open invoice ${i.number}, ${coupleName(i.names)}`} onClick={onOpen}>
            <span className="block truncate type-label text-zebra-950">{coupleName(i.names)}</span>
            <span className="block truncate type-body text-zebra-500">
              {i.label} · #{i.number}
            </span>
          </StretchedButton>
        </div>
        <span className="text-right type-label tabular-nums text-zebra-950">{money(i.amount)}</span>
        <span className="col-span-2 pl-[4.25rem] type-body text-zebra-500 lg:col-span-1 lg:pl-0">
          {i.when}
        </span>
        <div className="relative z-10 col-span-2 pl-[4.25rem] pt-2 lg:col-span-1 lg:justify-self-end lg:p-0">
          {late ? (
            <Swap
              active={reminded ? 'done' : 'remind'}
              className="justify-items-end"
              states={{
                remind: (
                  <Button variant="secondary" onClick={onRemind} className="whitespace-nowrap">
                    Send reminder
                  </Button>
                ),
                done: (
                  <Badge size="control" tone="brand">
                    <DrawnCheck className="size-3.5" />
                    Reminded
                  </Badge>
                ),
              }}
            />
          ) : null}
        </div>
      </div>
    </li>
  );
}
