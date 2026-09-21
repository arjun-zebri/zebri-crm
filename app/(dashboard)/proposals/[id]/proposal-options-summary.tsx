/**
 * The proposal detail page's Options section.
 *
 * Extracted verbatim from `proposal-detail.tsx` (Phase D) so that file
 * keeps its own body, plus the two new engagement components mounted
 * below it, under the file-length convention.
 *
 * @module app/(dashboard)/proposals/[id]/proposal-options-summary
 */
import type { ProposalDetailRow } from '@/app/(dashboard)/proposals/use-proposals';

const money = (n: number) => `$${n.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;

export interface ProposalOptionsSummaryProps {
  /** The proposal's saved options, in any order (sorted here by `position`). */
  options: ProposalDetailRow['proposal_options'];
  /** The proposal's headline total, as computed by `headlineTotal`. */
  headline: number;
}

/** Each saved option with its subtotal and "Most popular" flag, plus the headline total. */
export function ProposalOptionsSummary({ options, headline }: ProposalOptionsSummaryProps) {
  return (
    <section className="space-y-2">
      <h2 className="text-section text-text">Options</h2>
      <ul className="divide-y divide-border rounded-control border border-border">
        {[...options].sort((a, b) => a.position - b.position).map((o) => (
          <li key={o.position} className="flex items-center justify-between px-3 py-2 text-body">
            <span className="text-text">{o.title}{o.is_popular ? <span className="ml-2 text-text-subtle">Most popular</span> : null}</span>
            <span className="text-text-muted">{money(Number(o.subtotal))}</span>
          </li>
        ))}
      </ul>
      <p className="text-body text-text-muted">Headline {money(headline)}</p>
    </section>
  );
}
