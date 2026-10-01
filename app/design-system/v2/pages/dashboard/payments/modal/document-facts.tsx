import { Badge } from '@/components/ui-v2/badge';

import { money, type Contract, type HistoryItem } from '../payments-data';

/**
 * The facts and history lists the document modal's side column is made
 * of. `History` is shared with the invoice side column: what happened,
 * newest first, a missed due date in red. `ContractFacts` is a
 * contract's whole side column: who has signed, the event and package,
 * then its history. Plain label and value pairs, no boxes.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/document-facts
 */

/** What happened to a document, newest first. `compact` tightens it for a narrow side column (the proposal modal). */
export function History({ items, compact = false }: { items: HistoryItem[]; compact?: boolean }) {
  return (
    <ol className={`${compact ? 'space-y-2.5' : 'space-y-3'} type-body`}>
      {items.map((h) => (
        <li key={`${h.when}-${h.text}`} className={`grid ${compact ? 'grid-cols-[5rem_minmax(0,1fr)] gap-x-3' : 'grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4'}`}>
          <span className="text-zebra-500">{h.when}</span>
          <span className={h.text.startsWith('Fell due') ? 'text-danger' : 'text-zebra-950'}>{h.text}</span>
        </li>
      ))}
    </ol>
  );
}

/** Signers, facts and history for a contract. */
export function ContractFacts({ contract: c, reminded }: { contract: Contract; reminded: boolean }) {
  const history = reminded ? [{ when: 'Just now', text: 'You sent a reminder to sign' }, ...c.history] : c.history;
  return (
    <div className="space-y-8">
      <section aria-labelledby="doc-signers" className="space-y-3">
        <h3 id="doc-signers" className="type-body text-zebra-500">
          Signers
        </h3>
        <ul className="space-y-3 type-body">
          {c.signers.map((s) => (
            <li key={s.name} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-zebra-950">
                {s.name}
                {s.role === 'You' ? <span className="text-zebra-400"> (you)</span> : null}
              </span>
              {s.signed ? <Badge tone="brand">Signed {s.signed}</Badge> : <Badge>Waiting</Badge>}
            </li>
          ))}
        </ul>
      </section>
      <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4 gap-y-3 type-body">
        <dt className="text-zebra-500">Event</dt>
        <dd className="text-zebra-950">{c.event}</dd>
        <dt className="text-zebra-500">Package</dt>
        <dd className="text-zebra-950">
          {c.item}, {money(c.total)}
        </dd>
      </dl>
      <section aria-labelledby="doc-history" className="space-y-3">
        <h3 id="doc-history" className="type-body text-zebra-500">
          History
        </h3>
        <History items={history} />
      </section>
    </div>
  );
}
