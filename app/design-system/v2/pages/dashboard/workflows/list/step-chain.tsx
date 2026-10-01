import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';

import { STEP_ICON } from '../builder/step-icons';
import type { Step } from '../model';

/**
 * What a workflow does, in one line on its list row: each top-level step
 * as its icon and a word or two, in order. It answers "what does this
 * do?" without opening the builder. Branch steps (inside an If) are left
 * out; the If says a branch is there. Past four steps the rest fold
 * into "+N", so a long workflow never pushes the row's numbers away.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/list/step-chain
 */

const SHOWN = 4;

/** A step in a word or two: the story's full line is the builder's job. */
function shortLabel(s: Step, workflowName: (id: string) => string): string {
  switch (s.kind) {
    case 'email':
      return 'Email';
    case 'document':
      return s.doc;
    case 'todo':
      return 'To-do';
    case 'appointment':
      return s.title;
    case 'stage':
      return s.stage;
    case 'if':
      // "the proposal isn't accepted" reads as "If proposal not accepted".
      return `If ${s.condition.replace(/^the (\w+) isn't /, '$1 not ').replace(/^they haven't replied$/, 'no reply')}`;
    case 'start':
      return workflowName(s.workflow);
  }
}

export interface StepChainProps {
  steps: Step[];
  workflowName: (id: string) => string;
}

/** A workflow's steps in one line. See {@link StepChainProps}. */
export function StepChain({ steps, workflowName }: StepChainProps) {
  if (steps.length === 0) return <span className="type-body text-zebra-400">No steps yet</span>;
  const shown = steps.slice(0, SHOWN);
  const more = steps.length - shown.length;
  return (
    <span className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap type-body text-zebra-700">
      {shown.map((s, i) => {
        const Icon = STEP_ICON[s.kind];
        return (
          <Fragment key={s.id}>
            {i > 0 ? <ChevronRight aria-hidden="true" strokeWidth={1.5} className="size-3.5 shrink-0 text-zebra-300" /> : null}
            <span className="flex min-w-0 items-center gap-1.5">
              <Icon aria-hidden="true" strokeWidth={1.5} className="size-3.5 shrink-0 text-zebra-400" />
              <span className="truncate">{shortLabel(s, workflowName)}</span>
            </span>
          </Fragment>
        );
      })}
      {more > 0 ? <span className="shrink-0 tabular-nums text-zebra-400">+{more}</span> : null}
    </span>
  );
}
