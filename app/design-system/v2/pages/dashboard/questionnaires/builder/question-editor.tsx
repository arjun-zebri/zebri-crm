'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';


import { Button } from '@/components/ui-v2/button';
import { Dropdown } from '@/components/ui-v2/dropdown';
import { CommonQuestionsIcon, CopyLinkIcon, DragIcon, HeadingIcon, NotesIcon, TrashIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { Switch } from '@/components/ui-v2/switch';

import { TYPE_META, TYPES, type Question, type QuestionType } from '../questionnaire-data';

import { OptionsEditor } from './options-editor';

/**
 * One question in the builder. At rest it is one line: its wording (or
 * "Your question" in grey) and its type, with a handle on hover to drag
 * it into place. Clicked, it opens where it is: the wording and a hint,
 * each a line led by its icon (option G), the choices for a type that has them, then a quiet
 * row with the type, Required, Duplicate and Delete. One open at a time,
 * so the list reads as the questionnaire, not a form about one.
 *
 * @module app/design-system/v2/pages/dashboard/questionnaires/builder/question-editor
 */

export interface QuestionEditorProps {
  question: Question;
  /** Its number among the questions that ask something; none for a section. */
  number: number | null;
  open: boolean;
  onOpen: () => void;
  onChange: (q: Question) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const TYPE_OPTIONS = TYPES.map((t) => ({ value: t, label: TYPE_META[t].label }));

/** One question. See {@link QuestionEditorProps}. */
export function QuestionEditor({ question: q, number, open, onOpen, onChange, onDuplicate, onDelete }: QuestionEditorProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id });
  const section = q.type === 'section';
  const set = (patch: Partial<Question>) => onChange({ ...q, ...patch });
  const retype = (type: QuestionType) =>
    set({ type, options: TYPE_META[type].hasOptions ? (q.options.length ? q.options : ['', '']) : [], required: type === 'section' ? false : q.required });
  return (
    <li
      ref={setNodeRef}
      // dnd-kit moves the row with a transform it works out each frame.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group relative rounded-panel transition-colors duration-150 motion-reduce:transition-none ${open ? 'bg-pressed' : 'hover:bg-hover'} ${isDragging ? 'z-10 bg-field shadow-lg' : ''}`}
    >
      <button
        type="button"
        aria-label={`Drag ${q.label || 'question'}`}
        {...attributes}
        {...listeners}
        className="absolute left-0 top-3 flex h-6 w-5 cursor-grab items-center justify-center rounded-check text-zebra-400 opacity-0 transition-opacity duration-150 focus-mark group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
      >
        <DragIcon aria-hidden="true" className="size-4" />
      </button>
      {open ? (
        <div className="space-y-3 py-3 pl-6 pr-3">
          <div className="space-y-1">
            {/* The builder's own fields are lines led by their icons (option G), all one size. */}
            <Input
              wide
              autoFocus={!q.label}
              icon={section ? HeadingIcon : CommonQuestionsIcon}
              label={section ? 'Section heading' : 'Your question'}
              value={q.label}
              onChange={(e) => set({ label: e.target.value })}
            />
            <Input
              wide
              icon={NotesIcon}
              label={section ? 'Line under the heading' : 'Hint for the client'}
              value={q.help}
              onChange={(e) => set({ help: e.target.value })}
            />
          </div>
          {TYPE_META[q.type].hasOptions ? <OptionsEditor options={q.options} onChange={(options) => set({ options })} /> : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Dropdown inline label="Type" options={TYPE_OPTIONS} value={q.type} onChange={(t) => retype(t as QuestionType)} />
            {section ? null : (
              <label className="flex cursor-pointer items-center gap-2 type-body text-zebra-600">
                <Switch checked={q.required} onChange={(required) => set({ required })} aria-label="Required" />
                Required
              </label>
            )}
            <span className="ml-auto flex items-center">
              <Button variant="ghost" square aria-label="Duplicate" onClick={onDuplicate}>
                <CopyLinkIcon aria-hidden="true" className="size-4" />
              </Button>
              <Button variant="ghost" square aria-label="Delete" onClick={onDelete}>
                <TrashIcon aria-hidden="true" className="size-4" />
              </Button>
            </span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full items-baseline gap-3 rounded-panel py-3 pl-6 pr-3 text-left focus-mark"
        >
          {number ? <span className="w-5 shrink-0 type-body tabular-nums text-zebra-400">{number}</span> : null}
          <span className={`min-w-0 flex-1 truncate ${section ? 'type-subheading' : 'type-body'} ${q.label ? 'text-zebra-950' : 'text-zebra-400'}`}>
            {q.label || (section ? 'Section heading' : 'Your question')}
            {q.required ? <span className="text-zebra-400"> *</span> : null}
          </span>
          <span className="shrink-0 type-body text-zebra-400">{TYPE_META[q.type].label}</span>
        </button>
      )}
    </li>
  );
}
