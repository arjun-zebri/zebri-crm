'use client';

/**
 * The steps column of the sequence editor: one card per message step, and
 * the "Add step" button at the end. Owns no state; every change goes back
 * through `setDraft` so the editor keeps one source of truth.
 *
 * @module features/outreach/views/sequences/steps-pane
 */
import { Plus } from 'lucide-react';
import type { ComponentProps, Dispatch, SetStateAction } from 'react';

import { Button } from '@/components/ui/button';

import { MAX_STEPS, type DraftSequence } from './sequence-draft';
import { addStep, addVariant, moveStep, patchStep, patchVariant, removeStep, removeVariant } from './sequence-ops';
import { StepEditor } from './step-editor';

/** Props for {@link StepsPane}. */
export interface StepsPaneProps {
  steps: DraftSequence['steps'];
  focusedKey: string | null;
  /** False hides the column on a phone while the preview pane is showing. */
  visible: boolean;
  setDraft: Dispatch<SetStateAction<DraftSequence>>;
  onFocusVariant: (key: string | null) => void;
  bindBody: ComponentProps<typeof StepEditor>['bindBody'];
}

/** Scrollable list of step editors with the Add step button. */
export function StepsPane({ steps, focusedKey, visible, setDraft, onFocusVariant, bindBody }: StepsPaneProps) {
  return (
    <div className={`min-h-0 space-y-4 overflow-y-auto pb-2 md:pr-2 ${visible ? '' : 'hidden'} md:block`}>
      {steps.map((step, i) => (
        <StepEditor
          key={step.key}
          step={step}
          index={i}
          total={steps.length}
          focusedKey={focusedKey}
          onPatch={(patch) => setDraft((d) => patchStep(d, step.key, patch))}
          onMove={(dir) => setDraft((d) => moveStep(d, step.key, dir))}
          onRemove={() => setDraft((d) => removeStep(d, step.key))}
          onAddVariant={() => setDraft((d) => addVariant(d, step.key))}
          onRemoveVariant={(vk) => setDraft((d) => removeVariant(d, step.key, vk))}
          onPatchVariant={(vk, patch) => setDraft((d) => patchVariant(d, step.key, vk, patch))}
          onFocusVariant={onFocusVariant}
          bindBody={bindBody}
        />
      ))}
      <Button variant="outline" disabled={steps.length >= MAX_STEPS} onClick={() => setDraft((d) => addStep(d))}>
        <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
        Add step
      </Button>
    </div>
  );
}
