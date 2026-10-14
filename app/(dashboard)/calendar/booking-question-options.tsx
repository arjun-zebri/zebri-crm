'use client';

import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QUESTION_LIMITS } from '@/lib/booking/questions';

/** Fewest options a choice question can have. Mirrors the shared schema. */
const MIN_OPTIONS = 2;

interface BookingQuestionOptionsProps {
  /** The current option labels, in display order. */
  options: string[];
  /** Replace the whole list. */
  onChange: (options: string[]) => void;
  /** Validation message for the list as a whole, e.g. "needs at least two options". */
  error?: string | undefined;
}

/**
 * Editable list of choices for a single or multiple choice question.
 *
 * Removal stops at {@link MIN_OPTIONS} so the editor cannot reach a state the
 * shared schema would reject. Blank options still get a message on save,
 * because blanking a field while typing is normal and should not be fought.
 *
 * @module app/(dashboard)/calendar/booking-question-options
 */
export function BookingQuestionOptions({ options, onChange, error }: BookingQuestionOptionsProps) {
  const setAt = (index: number, value: string) =>
    onChange(options.map((o, i) => (i === index ? value : o)));
  const removeAt = (index: number) => onChange(options.filter((_, i) => i !== index));
  const atLimit = options.length >= QUESTION_LIMITS.maxOptions;

  return (
    <div className="space-y-2">
      <p className="text-body text-text-muted">Options</p>
      {options.map((option, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Input
              aria-label={`Option ${index + 1}`}
              placeholder={`Option ${index + 1}`}
              value={option}
              maxLength={QUESTION_LIMITS.optionLength}
              onChange={(e) => setAt(index, e.target.value)}
            />
          </div>
          <Button
            variant="ghost"
            iconOnly
            aria-label={`Remove option ${index + 1}`}
            disabled={options.length <= MIN_OPTIONS}
            onClick={() => removeAt(index)}
          >
            <X size={16} strokeWidth={1.5} />
          </Button>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-body text-danger">
          {error}
        </p>
      )}
      <Button
        variant="ghost"
        disabled={atLimit}
        onClick={() => onChange([...options, ''])}
      >
        <Plus size={16} strokeWidth={1.5} />
        Add option
      </Button>
    </div>
  );
}
