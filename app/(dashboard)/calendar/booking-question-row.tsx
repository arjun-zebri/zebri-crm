'use client';

import { ArrowDown, ArrowUp, ChevronDown, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  QUESTION_MAPPING_LABELS,
  QUESTION_TYPE_LABELS,
  type BookingQuestion,
  type QuestionMapping,
} from '@/lib/booking/questions';

import { BookingQuestionEditor } from './booking-question-editor';

interface BookingQuestionRowProps {
  question: BookingQuestion;
  index: number;
  count: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  /** Mappings other questions already claim. */
  mappingsTaken: Set<QuestionMapping>;
  onChange: (patch: Partial<BookingQuestion>) => void;
  onClearMapping: () => void;
  /** Validation message for this question. Also forces the row open so the message is visible. */
  error?: string | undefined;
}

/**
 * One row in the booking form's question list.
 *
 * The header button expands the editor; the icon buttons reorder and delete
 * without expanding. Keeping those as siblings rather than nested inside the
 * toggle means a keyboard user never lands on a control inside a control.
 *
 * @module app/(dashboard)/calendar/booking-question-row
 */
export function BookingQuestionRow({
  question,
  index,
  count,
  expanded,
  onToggleExpanded,
  onMove,
  onRemove,
  mappingsTaken,
  onChange,
  onClearMapping,
  error,
}: BookingQuestionRowProps) {
  const meta = [
    QUESTION_TYPE_LABELS[question.type],
    question.required ? 'Required' : null,
    question.maps_to ? `Saves to ${QUESTION_MAPPING_LABELS[question.maps_to]}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="rounded-control border border-border bg-surface">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggleExpanded}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-control px-1 py-1 text-left"
        >
          <ChevronDown
            size={16}
            strokeWidth={1.5}
            className={`shrink-0 text-text-subtle transition ${expanded ? 'rotate-180' : ''}`}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body text-text">
              {question.label.trim() || 'Untitled question'}
            </span>
            <span className="block truncate text-body text-text-muted">{meta}</span>
          </span>
        </button>
        <Button
          variant="ghost"
          iconOnly
          aria-label={`Move question ${index + 1} up`}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowUp size={16} strokeWidth={1.5} />
        </Button>
        <Button
          variant="ghost"
          iconOnly
          aria-label={`Move question ${index + 1} down`}
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDown size={16} strokeWidth={1.5} />
        </Button>
        <Button
          variant="ghost"
          iconOnly
          aria-label={`Delete question ${index + 1}`}
          onClick={onRemove}
        >
          <Trash2 size={16} strokeWidth={1.5} />
        </Button>
      </div>

      {expanded && (
        <div className="border-t border-border px-3 py-3">
          <BookingQuestionEditor
            question={question}
            mappingsTaken={mappingsTaken}
            onChange={onChange}
            onClearMapping={onClearMapping}
            error={error}
          />
        </div>
      )}
      {!expanded && error && (
        <p role="alert" className="px-3 pb-2 text-body text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
