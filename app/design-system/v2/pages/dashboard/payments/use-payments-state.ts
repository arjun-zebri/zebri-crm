'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { TODAY } from './dates';
import { finish, type Invoice, type InvoiceSeed } from './payments-data';

/**
 * What the MC has done on the Payments page this visit: invoices marked
 * paid and reminders sent. Shared by every tab and the document modal,
 * so a reminder sent from one place shows everywhere, and an invoice
 * marked paid moves out of Overdue and into the Overview's received
 * total at once. Demo only: nothing is saved, a reload starts over.
 *
 * @module app/design-system/v2/pages/dashboard/payments/use-payments-state
 */

/** Long enough to see the spinner, short enough not to feel slow. */
const CHASE_MS = 900;

/** What the views read and call. See {@link usePaymentsState}. */
export interface PaymentsState {
  /** Invoice and contract ids a reminder has gone out for. */
  reminded: ReadonlySet<string>;
  remind: (id: string) => void;
  /** Sends Zebri's reminder to every id at once; `chasing` while it goes. */
  chaseAll: (ids: string[]) => void;
  chasing: boolean;
  markPaid: (id: string) => void;
  /** Invoice ids whose automatic follow-up the MC has paused. */
  paused: ReadonlySet<string>;
  togglePause: (id: string) => void;
  /** Every invoice, worked out against today and anything marked paid. */
  invoices: Invoice[];
}

/** Payments page state over the account's invoices (`seeds`). See {@link PaymentsState}. */
export function usePaymentsState(seeds: InvoiceSeed[]): PaymentsState {
  const [reminded, setReminded] = useState<ReadonlySet<string>>(() => new Set());
  const [paid, setPaid] = useState<ReadonlySet<string>>(() => new Set());
  const [chasing, setChasing] = useState(false);
  const [paused, setPaused] = useState<ReadonlySet<string>>(() => new Set());
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const invoices = useMemo(
    () =>
      seeds.map((s) =>
        finish(
          paid.has(s.id)
            ? { ...s, paidOn: TODAY, method: 'Bank transfer', history: [{ when: 'Today', text: 'Marked paid by you' }, ...s.history] }
            : s,
        ),
      ),
    [seeds, paid],
  );
  return {
    reminded,
    remind: (id) => setReminded((s) => new Set(s).add(id)),
    chaseAll(ids) {
      setChasing(true);
      timer.current = window.setTimeout(() => {
        setReminded((s) => new Set([...s, ...ids]));
        setChasing(false);
      }, CHASE_MS);
    },
    chasing,
    markPaid: (id) => setPaid((s) => new Set(s).add(id)),
    paused,
    togglePause: (id) =>
      setPaused((s) => {
        const next = new Set(s);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    invoices,
  };
}
