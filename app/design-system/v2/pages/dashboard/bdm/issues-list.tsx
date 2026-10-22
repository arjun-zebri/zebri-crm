'use client';

import { Button } from '@/components/ui-v2/button';

import { applyFix } from './bdm-store';
import type { Issue } from './rules';

/**
 * What BDM won't accept, listed where it blocks the celebrant: each
 * answer, what is wrong in plain words, and Fix when the fix is certain
 * (Zebri makes it), or Go to it when only the couple or celebrant can
 * say. Fix all does every certain one at once.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/issues-list
 */

export interface IssuesListProps {
  client: string;
  issues: Issue[];
  /** Shows the answer an issue is about, when it has no certain fix. */
  onGoto: (issue: Issue) => void;
}

/** The list. See {@link IssuesListProps}. Renders nothing when there is nothing to fix. */
export function IssuesList({ client, issues, onGoto }: IssuesListProps) {
  if (!issues.length) return null;
  const fixable = issues.filter((i) => i.fix);
  return (
    <section aria-labelledby="bdm-issues" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 id="bdm-issues" className="type-label text-zebra-950">
          {issues.length === 1 ? 'BDM won’t accept this until it’s fixed' : 'BDM won’t accept these until they’re fixed'}
        </h4>
        {fixable.length > 1 ? (
          <Button variant="plain" onClick={() => fixable.forEach((i) => i.fix && applyFix(client, i.fix))}>
            Fix all
          </Button>
        ) : null}
      </div>
      <ul className="space-y-1">
        {issues.map((i) => (
          <li key={i.key} className="flex items-center gap-3 py-1">
            <span className="size-1.5 shrink-0 rounded-pill bg-warning" aria-hidden="true" />
            <span className="min-w-0 flex-1 type-body">
              <span className="text-zebra-950">{i.label}</span>
              <span className="text-zebra-500"> · {i.problem}</span>
            </span>
            {i.fix ? (
              <Button variant="secondary" aria-label={`Fix ${i.label}`} onClick={() => i.fix && applyFix(client, i.fix)}>
                Fix
              </Button>
            ) : (
              <Button variant="plain" aria-label={`Go to ${i.label}`} onClick={() => onGoto(i)}>
                Go to it
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
