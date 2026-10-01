'use client';

import { Plus, Zap } from 'lucide-react';

import { Button } from '@/components/ui-v2/button';
import { StretchedButton } from '@/components/ui-v2/stretched-button';

import type { Step, Workflow } from '../model';
import { triggerLine } from '../triggers';

import { InsertMenu } from './insert-menu';
import { StepList } from './step-list';

/**
 * The workflow as a story, top to bottom: what starts it (with who it
 * applies to, in words), then every step in order, then "Add a step".
 * The order is the logic: there is no canvas to arrange, and a phone
 * reads it the same way a laptop does.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/builder/story
 */

export interface StoryProps {
  workflow: Workflow;
  /** A step id, `'trigger'`, or null. */
  selected: string | null;
  changed: ReadonlySet<string>;
  dates: Map<string, string> | null;
  workflowName: (id: string) => string;
  onSelect: (id: string) => void;
  onInsert: (parent: string | null, index: number, step: Step) => void;
}

/** The story. See {@link StoryProps}. */
export function Story({ workflow: w, selected, changed, dates, workflowName, onSelect, onInsert }: StoryProps) {
  const filters = w.trigger.filters.length ? w.trigger.filters.join(' · ') : 'Every client';
  return (
    <div className="space-y-2">
      <div
        className={`relative grid grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-x-3 rounded-button px-3 py-3 transition-colors duration-150 motion-reduce:transition-none ${
          selected === 'trigger' ? 'bg-zebra-950/5' : 'hover:bg-zebra-950/[0.03]'
        }`}
      >
        <span className="flex size-7 items-center justify-center rounded-button bg-zebra-950 text-zebra-50">
          <Zap aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
        </span>
        <StretchedButton label={`${triggerLine(w.trigger.id)}, ${filters}. Change what starts it`} onClick={() => onSelect('trigger')}>
          <span className="block truncate type-heading text-zebra-950">{triggerLine(w.trigger.id)}</span>
          <span className="block truncate type-body text-zebra-500">{filters}</span>
        </StretchedButton>
      </div>
      <StepList
        steps={w.steps}
        parent={null}
        selected={selected}
        changed={changed}
        dates={dates}
        workflowName={workflowName}
        onSelect={onSelect}
        onInsert={onInsert}
      />
      <InsertMenu
        where="at the end"
        onPick={(step) => onInsert(null, w.steps.length, step)}
        trigger={
          <Button variant="secondary" className="ml-3">
            <Plus aria-hidden="true" strokeWidth={1.5} className="size-4" />
            Add a step
          </Button>
        }
      />
    </div>
  );
}
