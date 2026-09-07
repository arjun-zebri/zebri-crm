'use client';

/**
 * Editing a manual step from the detail modal.
 *
 * A to-do the MC wrote is the one kind of step whose whole content is
 * theirs, so opening it has to let them fix it: the wording, the note
 * they left themselves, and the date. Everything else about a step is
 * decided in the builder.
 *
 * Fields only. The modal owns the save, so there is one place that
 * knows what a successful write does to the list.
 *
 * @module app/(dashboard)/workflows/step-detail-edit
 */

import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

/** The editable parts of a manual step. */
export interface ManualStepEdit {
  title: string;
  description: string;
  /** `YYYY-MM-DD`, or empty for no date. */
  due: string;
}

export interface StepDetailEditProps {
  value: ManualStepEdit;
  onChange: (next: ManualStepEdit) => void;
}

/** The manual-step fields. See {@link StepDetailEditProps}. */
export function StepDetailEdit({ value, onChange }: StepDetailEditProps) {
  return (
    <div className="space-y-2">
      <Input
        label="What needs doing"
        value={value.title}
        onChange={(e) => onChange({ ...value, title: e.currentTarget.value })}
      />
      <Textarea
        label="Notes"
        rows={4}
        placeholder="Anything you need to remember when you get to this"
        value={value.description}
        onChange={(e) => onChange({ ...value, description: e.currentTarget.value })}
      />
      <div className="space-y-1">
        <span className="block text-body font-medium text-text">Due date</span>
        <DatePicker
          value={value.due}
          onChange={(due) => onChange({ ...value, due })}
          placeholder="No date"
        />
      </div>
    </div>
  );
}
