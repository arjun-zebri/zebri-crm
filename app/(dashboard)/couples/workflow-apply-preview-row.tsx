'use client';

/**
 * One step in the Start preview: what it is, when it runs for this
 * couple, and, for a step whose date has already passed, the one plain
 * reason it will be skipped.
 *
 * @module app/(dashboard)/couples/workflow-apply-preview-row
 */

import { AlertTriangle, GitBranch, ListTodo, Timer, Zap, type LucideIcon } from 'lucide-react';

import type { ApplyPreviewRow } from '@/lib/workflows/apply-projection';

/** Icon by step type; anything manual reads as a to-do. */
const TYPE_ICON: Record<string, LucideIcon> = {
  action: Zap,
  wait: Timer,
  branch: GitBranch,
};

/** The reason shown on a skipped row, word for word. */
export const SKIPPED_REASON = 'Date already passed, will be skipped';

/** The right-hand label: the date, or why there is none yet. */
function whenLabel(row: ApplyPreviewRow): string {
  if (row.date) return row.date;
  if (row.flag === 'needs_wedding_date') return 'Needs a wedding date';
  return '';
}

/** A single preview row. */
export function WorkflowApplyPreviewRow({ row }: { row: ApplyPreviewRow }) {
  const skipped = row.flag === 'skipped_past';
  const Icon = skipped ? AlertTriangle : (TYPE_ICON[row.type] ?? ListTodo);
  const detail = skipped
    ? SKIPPED_REASON
    : row.flag === 'manual'
      ? `${row.timing}. You tick this one off.`
      : row.timing;

  return (
    <li className="flex items-start gap-3 py-2.5">
      {/* Indent branch children rather than nesting a bordered box. */}
      {row.depth > 0 ? <span className="w-6 shrink-0" aria-hidden /> : null}
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${skipped ? 'text-warning' : 'text-text-muted'}`}
        strokeWidth={1.5}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <span className={`block truncate text-body ${skipped ? 'text-text-muted' : 'text-text'}`}>
          {row.title}
        </span>
        <span className="block text-body text-text-muted">{detail}</span>
      </div>
      <span
        className={`shrink-0 text-body text-text-muted ${skipped ? 'line-through' : ''}`}
      >
        {whenLabel(row)}
      </span>
    </li>
  );
}
