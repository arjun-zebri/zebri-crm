/**
 * Immutable edits to a sequence draft: every function returns a new
 * draft, so React state updates stay simple and predictable.
 *
 * @module features/outreach/views/sequences/sequence-ops
 */
import {
  type DraftSequence, type DraftStep, type DraftVariant, MAX_STEPS, MAX_VARIANTS, type StepPatch, type VariantPatch,
  blankStep, blankVariant, nextVariantLabel,
} from './sequence-draft';

/** Return a copy of the draft with one step changed. */
export function patchStep(draft: DraftSequence, stepKey: string, patch: StepPatch): DraftSequence {
  return { ...draft, steps: draft.steps.map((s) => (s.key === stepKey ? { ...s, ...patch } : s)) };
}

/** Return a copy with one step moved up (-1) or down (1). Out-of-range moves are ignored. */
export function moveStep(draft: DraftSequence, stepKey: string, dir: -1 | 1): DraftSequence {
  const from = draft.steps.findIndex((s) => s.key === stepKey);
  const to = from + dir;
  if (from === -1 || to < 0 || to >= draft.steps.length) return draft;
  const steps = [...draft.steps];
  const [moved] = steps.splice(from, 1);
  if (!moved) return draft;
  steps.splice(to, 0, moved);
  return { ...draft, steps };
}

/** Return a copy without the step. The sequence keeps at least one step. */
export function removeStep(draft: DraftSequence, stepKey: string): DraftSequence {
  if (draft.steps.length <= 1) return draft;
  return { ...draft, steps: draft.steps.filter((s) => s.key !== stepKey) };
}

/** Return a copy with a new step appended. Its delay defaults to one day after the last step. */
export function addStep(draft: DraftSequence): DraftSequence {
  if (draft.steps.length >= MAX_STEPS) return draft;
  return { ...draft, steps: [...draft.steps, blankStep('email', 1)] };
}

/** Return a copy with one variant changed. */
export function patchVariant(draft: DraftSequence, stepKey: string, variantKey: string, patch: VariantPatch): DraftSequence {
  return mapStep(draft, stepKey, (step) => ({
    ...step,
    variants: step.variants.map((v) => (v.key === variantKey ? { ...v, ...patch } : v)),
  }));
}

/** Return a copy with a blank variant added to a step. */
export function addVariant(draft: DraftSequence, stepKey: string): DraftSequence {
  return mapStep(draft, stepKey, (step) =>
    step.variants.length >= MAX_VARIANTS ? step : { ...step, variants: [...step.variants, blankVariant(nextVariantLabel(step))] },
  );
}

/** Return a copy without the variant. A step keeps at least one variant. */
export function removeVariant(draft: DraftSequence, stepKey: string, variantKey: string): DraftSequence {
  return mapStep(draft, stepKey, (step) =>
    step.variants.length <= 1 ? step : { ...step, variants: step.variants.filter((v) => v.key !== variantKey) },
  );
}

function mapStep(draft: DraftSequence, stepKey: string, fn: (step: DraftStep) => DraftStep): DraftSequence {
  return { ...draft, steps: draft.steps.map((s) => (s.key === stepKey ? fn(s) : s)) };
}

/** Find a variant and its step, for the preview and merge-field insertion. */
export function resolveVariant(draft: DraftSequence, variantKey: string | null): { step: DraftStep; index: number; variant: DraftVariant } | null {
  for (const [index, step] of draft.steps.entries()) {
    const variant = step.variants.find((v) => v.key === variantKey);
    if (variant) return { step, index, variant };
  }
  // Nothing focused, or the focused row was removed: preview the first message.
  const first = draft.steps[0];
  const firstVariant = first?.variants[0];
  return first && firstVariant ? { step: first, index: 0, variant: firstVariant } : null;
}
