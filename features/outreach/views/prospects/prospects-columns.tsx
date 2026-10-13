'use client';

/**
 * Column definitions for the Prospects table. Selection lives in the
 * view, so the checkbox columns read it from the props passed in here.
 *
 * @module features/outreach/views/prospects/prospects-columns
 */
import { createColumnHelper } from '@tanstack/react-table';

import { Checkbox } from '@/components/ui/checkbox';
import { StatePill } from '@/components/ui/state-pill';
import type { ProspectRow } from '@/lib/outreach/services/queries';

import { BAD_EMAIL_CHECKS, EMAIL_CHECK_LABELS, humanize, stageLabel } from './labels';
import { VerdictPill } from './verdict-pill';

const helper = createColumnHelper<ProspectRow>();

/** Inputs the columns need from the view. */
export interface ProspectColumnOptions {
  selected: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
  /** Opens the prospect modal. Wired to the name link so keyboard users can open a row. */
  onOpen: (id: string) => void;
  pageIds: string[];
}

/** The email cell: the address, where it came from, and whether it can get mail. */
function EmailCell({ row }: { row: ProspectRow }) {
  if (!row.email) return <span className="text-text-subtle">None</span>;
  const bad = (BAD_EMAIL_CHECKS as readonly string[]).includes(row.email_check);
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate text-text">{row.email}</span>
      {row.email_source === 'found' && <StatePill label="Found" tone="info" />}
      {bad && <StatePill label={EMAIL_CHECK_LABELS[row.email_check] ?? humanize(row.email_check)} tone="danger" dot="filled" />}
    </span>
  );
}

/** Build the table columns for the current selection. */
export function prospectColumns(opts: ProspectColumnOptions) {
  const allChecked = opts.pageIds.length > 0 && opts.pageIds.every((id) => opts.selected.has(id));
  return [
    helper.display({
      id: 'select',
      header: () => (
        <Checkbox
          checked={allChecked}
          onChange={(c) => opts.onToggleAll(opts.pageIds, c)}
          ariaLabel="Select all on this page"
        />
      ),
      cell: ({ row }) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={opts.selected.has(row.original.id)}
            onChange={(c) => opts.onToggle(row.original.id, c)}
            ariaLabel={`Select ${row.original.full_name}`}
          />
        </span>
      ),
    }),
    helper.accessor('full_name', {
      header: 'Name',
      // A real button, not a styled span: the row's click handler is
      // mouse-only, so this is the keyboard route into the drawer. Its own
      // click stops propagation so the row handler does not fire twice.
      cell: ({ row }) => (
        <span className="flex min-w-0 flex-col">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              opts.onOpen(row.original.id);
            }}
            className="block max-w-full truncate rounded-control text-left font-medium text-text cursor-pointer hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
          >
            {row.original.full_name}
          </button>
          <span className="block truncate text-body text-text-subtle">
            {[row.original.suburb, row.original.state].filter(Boolean).join(', ') || 'No location'}
          </span>
        </span>
      ),
    }),
    // Score, Instagram and Website live in the modal's Details tab. Keeping them
    // here made the table wider than a laptop screen and buried the status.
    helper.accessor('verdict', {
      header: 'Status',
      cell: (info) => <VerdictPill verdict={info.getValue()} />,
    }),
    helper.accessor('stage', {
      header: 'Stage',
      cell: (info) => <span className="text-text-muted">{stageLabel(info.getValue())}</span>,
    }),
    helper.accessor('email', {
      header: 'Email',
      cell: ({ row }) => <EmailCell row={row.original} />,
    }),
  ];
}
