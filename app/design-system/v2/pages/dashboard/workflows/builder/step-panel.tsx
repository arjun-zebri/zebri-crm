'use client';

import { Trash2, X, Zap } from 'lucide-react';

import { Button } from '@/components/ui-v2/button';
import { ChipGroup } from '@/components/ui-v2/chip-group';
import { Dropdown } from '@/components/ui-v2/dropdown';

import type { Step, Workflow } from '../model';
import { FILTERS, TRIGGERS } from '../triggers';

import { PropRow } from './prop-row';
import { StepFields } from './step-fields';
import { STEP_ICON, STEP_NAME } from './step-icons';

/**
 * The detail of whatever is picked in the story, beside it: what starts
 * the workflow (the trigger and who it applies to), or one step's
 * fields. Changes land in the story as they are typed. Remove sits at
 * the foot, alone and quiet. The caller puts this in a side column on wide
 * screens and in a Sheet on phones.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/builder/step-panel
 */

export interface StepPanelProps {
  workflow: Workflow;
  /** The picked step, or null for the trigger. */
  step: Step | null;
  others: Workflow[];
  onTrigger: (trigger: Workflow['trigger']) => void;
  onStep: (step: Step) => void;
  onRemove: () => void;
  onClose: () => void;
}

const triggerOptions = TRIGGERS.map((t) => ({ value: t.id, label: `When ${t.words}` }));

/** The step panel. See {@link StepPanelProps}. */
export function StepPanel({ workflow: w, step, others, onTrigger, onStep, onRemove, onClose }: StepPanelProps) {
  const Icon = step ? STEP_ICON[step.kind] : Zap;
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 px-5 pb-3 pt-4">
        <span className={`flex size-7 items-center justify-center rounded-button ${step ? 'bg-zebra-100 text-zebra-700' : 'bg-zebra-950 text-zebra-50'}`}>
          <Icon aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
        </span>
        <h2 id="step-panel-title" className="min-w-0 flex-1 truncate type-subheading text-zebra-950">
          {step ? STEP_NAME[step.kind] : 'What starts it'}
        </h2>
        <Button variant="ghost" square aria-label="Close" onClick={onClose}>
          <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2">
        {step ? (
          <StepFields step={step} others={others} onChange={onStep} />
        ) : (
          <div className="space-y-5">
            <PropRow label="Starts">
              <Dropdown label="Starts" inline options={triggerOptions} value={w.trigger.id} onChange={(id) => onTrigger({ ...w.trigger, id })} />
            </PropRow>
            <ChipGroup
              label="Only for"
              description="Leave empty for every client"
              multiple
              options={FILTERS}
              value={w.trigger.filters}
              onChange={(filters) => onTrigger({ ...w.trigger, filters })}
            />
          </div>
        )}
      </div>
      {step ? (
        <footer className="px-5 pb-4">
          {/* The plain button's muted tone: removing is rare, so it should not
              compete with the fields for attention. */}
          <Button variant="plain" onClick={onRemove} className="gap-1.5">
            <Trash2 aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
            Remove step
          </Button>
        </footer>
      ) : null}
    </div>
  );
}
