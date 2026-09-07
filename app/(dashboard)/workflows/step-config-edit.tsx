'use client';

/**
 * Editing what a non-email action step will do, before it does it.
 *
 * Same fields as the builder's inspector, rendered against the
 * *instance* step rather than the template: the builder decides what
 * every future couple gets, this decides what happens to this one. An
 * MC who spots the wrong stage on a step in their day should be able
 * to fix that step without editing the workflow behind it.
 *
 * The action's own slug is not editable here. Changing what a step is
 * is a builder decision.
 *
 * @module app/(dashboard)/workflows/step-config-edit
 */

import { configWithDefaults } from '@/lib/automations/action-defaults';
import type { ActionType } from '@/types/automations';

import { ActionFields } from './[id]/inspector-panel';

export interface StepConfigEditProps {
  actionType: string;
  config: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

/** The action's own fields. See {@link StepConfigEditProps}. */
export function StepConfigEdit({ actionType, config, onChange }: StepConfigEditProps) {
  // Read through the schema first: several actions store `{}` and carry
  // their real values as Zod defaults, and a form bound to the raw
  // config would show those fields empty and then save them empty.
  const withDefaults = configWithDefaults(actionType, config);

  return (
    <div className="space-y-3">
      <ActionFields
        actionType={actionType as ActionType}
        config={withDefaults}
        setConfig={onChange}
      />
    </div>
  );
}
