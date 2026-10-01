import type { ReactNode } from 'react';

/**
 * Design system v2 insight (preview): one piece of Zebri AI's advice,
 * set in the page with no box. It reads top to bottom: the finding in
 * bold, why Zebri thinks so in grey (with the numbers behind it), the
 * one fix to try in black, then an optional action that starts the fix.
 * One finding and one fix per insight: the point is what to do next,
 * not a report. It carries no Zebri mark of its own; whatever holds it
 * says it is Zebri's (the AI insights dialog's header, reached from a
 * `Button variant="ai"`). Stack a few with space between, no rules.
 *
 * Used in the Proposals Overview's AI insights dialog.
 *
 * @example
 * ```tsx
 * <Insight
 *   finding="Couples stall at your packages."
 *   why="8 of 15 who saw them didn't accept. Most were weighing Premium MC at $4,350."
 *   fix="Try leading with Classic MC and showing Premium MC as an upgrade."
 *   action={<Button variant="secondary">Try it on Full day MC</Button>}
 * />
 * ```
 *
 * @module components/ui-v2/insight
 */

export interface InsightProps {
  /** The one thing Zebri noticed, a short sentence. */
  finding: string;
  /** Why, with the numbers behind it. */
  why: string;
  /** The one change to try. */
  fix: string;
  /** Starts the fix, usually a secondary `Button`. */
  action?: ReactNode;
}

/** v2 insight. See {@link InsightProps}. */
export function Insight({ finding, why, fix, action }: InsightProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="type-label text-zebra-950">{finding}</p>
        <p className="type-body text-zebra-500">{why}</p>
      </div>
      <p className="type-body text-zebra-950">{fix}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
