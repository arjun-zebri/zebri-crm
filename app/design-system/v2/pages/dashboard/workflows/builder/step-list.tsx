'use client';

import { Plus } from 'lucide-react';

import { Button } from '@/components/ui-v2/button';

import type { Step } from '../model';

import { InsertMenu } from './insert-menu';
import { StepLine } from './step-line';

/**
 * A run of story lines, top level or inside an If. Between two lines,
 * hovering the gap shows a + to add a step there (hidden on touch
 * screens, where the "Add a step" at the end and the Ask bar do the
 * job). An If's own steps sit indented under it, each branch with its
 * own quiet "Add a step" so a branch can grow without leaving the page.
 * One hairline runs down through the icons, the thread of the story.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/builder/step-list
 */

export interface StepListProps {
  steps: Step[];
  /** The If these steps belong to, or null for the story itself. */
  parent: string | null;
  selected: string | null;
  changed: ReadonlySet<string>;
  dates: Map<string, string> | null;
  workflowName: (id: string) => string;
  onSelect: (id: string) => void;
  onInsert: (parent: string | null, index: number, step: Step) => void;
}

/** A run of lines. See {@link StepListProps}. */
export function StepList(props: StepListProps) {
  const { steps, parent, selected, changed, dates, workflowName, onSelect, onInsert } = props;
  return (
    <ol className="relative">
      {steps.length > 0 ? <span aria-hidden="true" className="absolute bottom-6 left-[1.625rem] top-6 w-px bg-zebra-200" /> : null}
      {steps.map((s, i) => (
        <li key={s.id}>
          <StepLine
            step={s}
            workflowName={workflowName}
            date={dates?.get(s.id)}
            selected={selected === s.id}
            changed={changed.has(s.id)}
            onSelect={() => onSelect(s.id)}
          />
          {s.kind === 'if' ? (
            <div className="ml-[1.625rem] border-l border-zebra-200 pb-2 pl-5">
              <StepList {...props} steps={s.then} parent={s.id} />
              <InsertMenu
                where={`inside ${s.condition}`}
                onPick={(step) => onInsert(s.id, s.then.length, step)}
                trigger={
                  <Button variant="plain" className="ml-3 text-zebra-500">
                    <Plus aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
                    {s.then.length ? 'Add a step here' : 'Then what?'}
                  </Button>
                }
              />
            </div>
          ) : null}
          {i < steps.length - 1 ? (
            <div className="group/gap relative z-10 -my-2 hidden h-4 items-center pl-[0.625rem] md:flex">
              <div className="opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover/gap:opacity-100 has-[[data-state=open]]:opacity-100 motion-reduce:transition-none">
                <InsertMenu where={`after step ${i + 1}`} onPick={(step) => onInsert(parent, i + 1, step)} />
              </div>
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
