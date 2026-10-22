'use client';

import { ROW } from '@/components/ui-v2/control-styles';
import { GroupLabel } from '@/components/ui-v2/group-label';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { ContractIcon, InvoiceIcon } from '@/components/ui-v2/icons';

import type { BookingTerms } from '../../doc-builder/state/use-doc-editor';
import { money } from '../../payments/payments-data';

/**
 * What saying yes sets going, as lines the MC can open: the contract
 * they sign, the deposit that holds the date, and the balance. Each line
 * shows that document on the left of Ready to send, so nothing goes out
 * in the MC's name that they have not been able to see (2026-10-08
 * review: Zebri sent a contract and an invoice a new MC never saw).
 * Lit while its document is the one showing.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/ready/when-yes
 */

/** The documents saying yes sends, as Ready to send's tabs name them. */
export type YesTab = 'contract' | 'deposit' | 'balance';

const BALANCE: Record<number, string> = { 14: 'two weeks', 30: 'a month', 60: 'two months' };

/** The lines for `terms` at `price`, in the order they go. */
export function yesLines(terms: BookingTerms, price: number): { tab: YesTab; title: string; when: string }[] {
  const deposit = Math.round((price * terms.deposit) / 100);
  const due = `Due ${BALANCE[terms.balanceDays] ?? `${terms.balanceDays} days`} before the wedding`;
  return [
    ...(terms.contract ? [{ tab: 'contract' as const, title: 'They sign your agreement', when: 'Sent the moment they say yes' }] : []),
    ...(terms.deposit ? [{ tab: 'deposit' as const, title: terms.deposit === 100 ? `${money(price)} paid in full` : `${money(deposit)} deposit`, when: terms.contract ? 'Sent once they sign' : 'Sent the moment they say yes' }] : []),
    ...(terms.deposit < 100 ? [{ tab: 'balance' as const, title: `${money(price - deposit)} balance`, when: due }] : []),
  ];
}

export interface WhenYesProps {
  terms: BookingTerms;
  price: number;
  /** The document showing on the left. */
  showing: string;
  onShow: (tab: YesTab) => void;
}

/** The section. See {@link WhenYesProps}. */
export function WhenYes({ terms, price, showing, onShow }: WhenYesProps) {
  return (
    <section aria-labelledby="when-yes" className="space-y-2">
      <GroupLabel as="h3" id="when-yes">
        When they say yes
      </GroupLabel>
      <ul className="-mx-2 space-y-1">
        {yesLines(terms, price).map(({ tab, title, when }) => {
          const Icon = tab === 'contract' ? ContractIcon : InvoiceIcon;
          return (
            <li key={tab}>
              <button
                type="button"
                aria-pressed={showing === tab}
                onClick={() => onShow(tab)}
                className={`flex w-full min-w-0 items-center gap-3 rounded-button p-2 text-left ${ROW}${showing === tab ? ' bg-pressed' : ''}`}
              >
                <IconCircle icon={Icon} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-zebra-950">{title}</span>
                  <span className="block truncate text-zebra-500">{when}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
