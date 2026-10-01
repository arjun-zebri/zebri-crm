import { Button } from '@/components/ui-v2/button';

import { useAccount } from '../../account';
import { whatsNext } from '../reports-data';
import type { PaymentsState } from '../use-payments-state';

import { RailRow, type RailItem } from './rail-row';

/**
 * The What's next rail beside the chart, straight on the backdrop, laid
 * out as the Proposals Overview's: one list of everything that needs the
 * MC or is coming in, as of today. What needs a move comes first (late
 * invoices, oldest first, then contracts waiting on a signature, longest
 * waiting first), then what falls due in the next 30 days, soonest
 * first. Every row has the same shape (`RailRow`). The list scrolls
 * inside the rail, so the chart sets the Overview's height.
 *
 * @module app/design-system/v2/pages/dashboard/payments/overview/whats-next
 */

export interface WhatsNextProps {
  state: PaymentsState;
  /** Lights a month on the chart while a row is pointed at. */
  onFocus: (month: string | null) => void;
  /** Opens an invoice; `chase` opens it with the drafted reminder out. */
  onOpen: (id: string, chase?: boolean) => void;
  onOpenContract: (id: string) => void;
  /** Goes to the Invoices tab. */
  onViewAll: () => void;
}

/** The rail. See {@link WhatsNextProps}. */
export function WhatsNext({ state, onFocus, onOpen, onOpenContract, onViewAll }: WhatsNextProps) {
  const invoices = whatsNext(state.invoices);
  const CONTRACTS = useAccount().contracts;
  const items: RailItem[] = [
    ...invoices.filter((i) => i.group === 'overdue').map((invoice) => ({ kind: 'invoice' as const, invoice })),
    ...CONTRACTS.filter((c) => c.group === 'waiting' && c.sentOn)
      .sort((a, b) => a.sentOn!.localeCompare(b.sentOn!))
      .map((contract) => ({ kind: 'contract' as const, contract })),
    ...invoices.filter((i) => i.group !== 'overdue').map((invoice) => ({ kind: 'invoice' as const, invoice })),
  ];
  return (
    <section aria-labelledby="whats-next-title" className="flex min-h-0 flex-col lg:absolute lg:inset-x-0 lg:bottom-0 lg:top-4">
      <div className="flex min-h-8 items-center justify-between gap-3 border-b border-zebra-950/15 pb-2">
        <h2 id="whats-next-title" className="type-subheading text-zebra-950">
          What&rsquo;s next
        </h2>
        <Button variant="plain" onClick={onViewAll}>
          All invoices
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="pt-3 type-body text-zebra-500">Nothing needs you and nothing falls due in the next 30 days.</p>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-zebra-950/5 overflow-y-auto">
          {items.map((item) => {
            const id = item.kind === 'invoice' ? item.invoice.id : item.contract.id;
            return (
              <li key={id}>
                <RailRow
                  item={item}
                  done={state.reminded.has(id)}
                  busy={state.chasing}
                  onOpen={() => (item.kind === 'invoice' ? onOpen(id) : onOpenContract(id))}
                  onAct={() => (item.kind === 'invoice' ? onOpen(id, true) : state.remind(id))}
                  onFocus={onFocus}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
