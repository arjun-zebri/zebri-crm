import { StretchedButton } from '@/components/ui-v2/stretched-button';

import { CoupleAvatars, ROW } from './invoice-row';
import { coupleName, money, signedLine, type Contract } from './payments-data';

/**
 * One contract row: the couple and the contract's name, the package
 * price, and where it stands: how many of the couple have signed while
 * it waits, "Not sent" for a draft, the date once signed. Clicking
 * anywhere on the row opens the contract. Same columns as an invoice
 * row, so switching tabs does not shift the page.
 *
 * @module app/design-system/v2/pages/dashboard/payments/contract-row
 */

/** A contract row. */
export function ContractRow({ contract: c, onOpen }: { contract: Contract; onOpen: () => void }) {
  return (
    <li>
      <div className={`${ROW} grid-cols-[minmax(0,1fr)_auto] items-center lg:grid-cols-[minmax(0,1fr)_7rem_10rem_9.5rem]`}>
        <div className="flex min-w-0 items-center gap-3">
          <CoupleAvatars names={c.names} />
          <StretchedButton label={`Open ${c.title}, ${coupleName(c.names)}`} onClick={onOpen}>
            <span className="block truncate type-label text-zebra-950">{coupleName(c.names)}</span>
            <span className="block truncate type-body text-zebra-500">
              {c.title} · {c.item}
            </span>
          </StretchedButton>
        </div>
        <span className="text-right type-label tabular-nums text-zebra-950">{money(c.total)}</span>
        <span className="col-span-2 pl-[4.25rem] type-body text-zebra-500 lg:col-span-1 lg:pl-0">
          {c.group === 'waiting' ? signedLine(c) : c.when}
        </span>
        <span className="hidden type-body text-zebra-400 lg:block lg:justify-self-end">
          {c.group === 'waiting' ? c.when : null}
        </span>
      </div>
    </li>
  );
}
