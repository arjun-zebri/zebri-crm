'use client';

import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useId } from 'react';

import { Button } from '@/components/ui-v2/button';
import { HeadingIcon, PlusIcon } from '@/components/ui-v2/icons';

import { newQuestion, TYPE_META, type Question } from '../questionnaire-data';

import { QuestionEditor } from './question-editor';

/**
 * The builder's questions, in order: drag one by its handle (or with the
 * keyboard) to move it, click one to open it. Add question puts a short
 * answer at the end and opens it; Add section puts a heading there, to
 * group what follows. The numbers count only questions that ask
 * something, as the client will see them.
 *
 * @module app/design-system/v2/pages/dashboard/questionnaires/builder/question-list
 */

export interface QuestionListProps {
  questions: Question[];
  onChange: (questions: Question[]) => void;
  /** The open question's id. */
  open: string | null;
  onOpen: (id: string | null) => void;
}

/** The questions. See {@link QuestionListProps}. */
export function QuestionList({ questions, onChange, open, onOpen }: QuestionListProps) {
  // A stable id, so the server and browser name dnd-kit's live region alike.
  const dnd = useId();
  const sensors = useSensors(
    // A few pixels before a drag starts, so a click on the handle stays a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = questions.findIndex((q) => q.id === active.id);
    const to = questions.findIndex((q) => q.id === over.id);
    onChange(arrayMove(questions, from, to));
  };
  const add = (q: Question) => (onChange([...questions, q]), onOpen(q.id));
  let n = 0;
  return (
    <div className="space-y-2">
      <DndContext id={dnd} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          <ul className="-mx-3 space-y-0.5">
            {questions.map((q, i) => (
              <QuestionEditor
                key={q.id}
                question={q}
                number={TYPE_META[q.type].isInput ? ++n : null}
                open={open === q.id}
                onOpen={() => onOpen(q.id)}
                onChange={(next) => onChange(questions.map((x) => (x.id === q.id ? next : x)))}
                onDuplicate={() => {
                  const copy = { ...newQuestion(q.type), ...q, id: newQuestion().id };
                  onChange([...questions.slice(0, i + 1), copy, ...questions.slice(i + 1)]);
                  onOpen(copy.id);
                }}
                onDelete={() => (onChange(questions.filter((x) => x.id !== q.id)), onOpen(null))}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <div className="-ml-2 flex flex-wrap gap-1">
        <Button variant="ghost" compact icon={<PlusIcon aria-hidden="true" className="size-4" />} onClick={() => add(newQuestion())}>
          Add question
        </Button>
        <Button variant="ghost" compact icon={<HeadingIcon aria-hidden="true" className="size-4" />} onClick={() => add(newQuestion('section'))}>
          Add section
        </Button>
      </div>
    </div>
  );
}
