'use client';

/**
 * Phone layout for the Prospects list: one card per person, tap to open.
 * Shown below `md`, where the table would need sideways scrolling.
 *
 * @module features/outreach/views/prospects/prospects-cards
 */
import { Checkbox } from '@/components/ui/checkbox';
import { StatePill } from '@/components/ui/state-pill';
import type { ProspectRow } from '@/lib/outreach/services/queries';

import { BAD_EMAIL_CHECKS, EMAIL_CHECK_LABELS, humanize, stageLabel } from './labels';
import { VerdictPill } from './verdict-pill';

/** Props for {@link ProspectsCards}. */
export interface ProspectsCardsProps {
  rows: ProspectRow[];
  selected: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  onOpen: (id: string) => void;
}

/** One person as a card: name, status, stage, and the contacts that matter. */
export function ProspectsCards({ rows, selected, onToggle, onOpen }: ProspectsCardsProps) {
  return (
    <ul className="md:hidden rounded-control border border-border bg-surface divide-y divide-border">
      {rows.map((row) => {
        const bad = (BAD_EMAIL_CHECKS as readonly string[]).includes(row.email_check);
        const place = [row.suburb, row.state].filter(Boolean).join(', ');
        return (
          <li key={row.id} className="flex items-start gap-3 p-4">
            <span className="pt-0.5" onClick={(e) => e.stopPropagation()}>
              <Checkbox checked={selected.has(row.id)} onChange={(c) => onToggle(row.id, c)} ariaLabel={`Select ${row.full_name}`} />
            </span>
            <button type="button" onClick={() => onOpen(row.id)} className="min-w-0 flex-1 space-y-2 text-left cursor-pointer">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-body font-medium text-text">{row.full_name}</span>
                <VerdictPill verdict={row.verdict} />
              </span>
              <span className="block text-body text-text-muted">
                {place || 'No location'}
                {' · '}
                {stageLabel(row.stage)}
              </span>
              <span className="block text-body text-text-muted truncate">
                {row.email ?? 'No email'}
                {row.instagram_handle && ` · @${row.instagram_handle.replace(/^@/, '')}`}
              </span>
              {(bad || row.do_not_contact) && (
                <span className="flex flex-wrap gap-2">
                  {bad && <StatePill label={EMAIL_CHECK_LABELS[row.email_check] ?? humanize(row.email_check)} tone="danger" dot="filled" />}
                  {row.do_not_contact && <StatePill label="Do not contact" tone="neutral" />}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
