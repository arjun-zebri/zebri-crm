'use client';

import { CalendarField } from '@/components/ui-v2/calendar-field';
import { ChipGroup } from '@/components/ui-v2/chip-group';
import { ComboField } from '@/components/ui-v2/combo-field';
import { DateField } from '@/components/ui-v2/date-field';
import { Dropdown } from '@/components/ui-v2/dropdown';
import { isQuestion } from '@/components/ui-v2/field';
import { CallIcon, ClockIcon, EmailIcon, ListIcon, ListOrderedIcon, TextIcon, type ZebriIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { Textarea } from '@/components/ui-v2/textarea';

import { answerText, type Answer, type Question, type QuestionType } from '../questionnaire-data';

import { SongSearch } from './song-search';

/**
 * One question as the client answers it, for every type: a section is a
 * heading; text, email, phone and number are fields; long answers a
 * text box; Pick one, Pick several and Yes or No are chips; a dropdown
 * is a dropdown; a date is a date field; a time is a field that takes
 * "6:30 pm"; a song is a song search. All ui-v2 controls, so the client's
 * page and the MC's copy look alike. A question with no wording yet
 * (still being written in the builder) reads "Your question". Every
 * answer is a line led by its icon (option G, 2026-10-14): the
 * question's own icon when it sets one (Zebri's fixed forms, such as the
 * BDM form, name each answer that way), else its type's. A short name
 * ("Occupation") is the grey placeholder; a question keeps its wording
 * in view over "Your answer" (see `Field`); a hint sits under the words
 * in the quiet grey. Nothing is marked optional: Submit is where Zebri
 * would ask for what is required. A fixed form that checks its answers
 * (the BDM form) passes `error`, shown under the answer in red, and for a
 * date the text that could not be read (`draft`), so it is kept.
 *
 * @module app/design-system/v2/pages/dashboard/questionnaires/fields/question-field
 */

export interface QuestionFieldProps {
  question: Question;
  value: Answer | undefined;
  onChange: (value: Answer) => void;
  /** What is wrong with the answer, under it. */
  error?: string | undefined;
  /** A date: the text typed that could not be read, kept across remounts. */
  draft?: string | undefined;
  /** A date: called with text it cannot read, and "" once it reads one. */
  onInvalid?: ((text: string) => void) | undefined;
  /**
   * Boxed fields with their names over them, hints shown under, choices
   * as a stacked list with each option's hint (`optionHints`): the
   * couple's BDM form (user, 2026-10-15), filled in once by someone who
   * has never seen Zebri, where a box says "type here" without being
   * learned. Text, date, dropdown and choice questions take it.
   */
  boxed?: boolean | undefined;
}

/** The icon a type's answer line takes when the question sets none. */
const TYPE_ICON: Partial<Record<QuestionType, ZebriIcon>> = {
  short_text: TextIcon,
  email: EmailIcon,
  phone: CallIcon,
  number: ListOrderedIcon,
  time: ClockIcon,
  dropdown: ListIcon,
};

/** Today, "YYYY-MM-DD", the latest a date in the past can be. */
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Past this many options a boxed dropdown becomes a typed `ComboField`. */
const LONG_LIST = 12;

/** One question. See {@link QuestionFieldProps}. */
export function QuestionField({ question: q, value, onChange, error, draft, onInvalid, boxed = false }: QuestionFieldProps) {
  const label = q.label.trim() || (q.type === 'section' ? 'Section' : 'Your question');
  const help = q.help.trim() || undefined;
  const text = answerText(value);
  const options = q.options.map((o) => o.trim()).filter(Boolean);
  const icon = q.icon ?? TYPE_ICON[q.type] ?? TextIcon;
  switch (q.type) {
    case 'section':
      return (
        <div className="space-y-1 pt-2">
          <h3 className="type-subheading text-zebra-950">{label}</h3>
          {help ? <p className="type-body text-zebra-500">{help}</p> : null}
        </div>
      );
    case 'long_text':
      return <Textarea label={label} help={help} error={error} value={text} onChange={(e) => onChange(e.target.value)} rows={3} />;
    case 'single_choice':
    case 'multiple_choice':
    case 'yes_no':
      return (
        <div>
          <ChipGroup
            label={label}
            description={help}
            options={q.type === 'yes_no' ? ['Yes', 'No'] : options.length ? options : ['Choice 1', 'Choice 2']}
            multiple={q.type === 'multiple_choice'}
            stacked={boxed}
            optional={boxed && !q.required}
            hints={boxed ? q.optionHints : undefined}
            value={Array.isArray(value) ? value : text ? [text] : []}
            onChange={(next) => onChange(q.type === 'multiple_choice' ? next : (next[0] ?? ''))}
          />
          <Problem text={error} />
        </div>
      );
    case 'dropdown':
      // A long list (the countries) is typed to narrow it; a short one stays a menu.
      if (boxed && options.length > LONG_LIST)
        return <ComboField label={label} options={options} pinned={q.pinned} value={text} onChange={onChange} optional={!q.required} help={help} error={error} />;
      return boxed ? (
        <Dropdown boxed optional={!q.required} label={label} options={(options.length ? options : ['Choice 1', 'Choice 2']).map((o) => ({ value: o, label: o }))} value={text} onChange={onChange} help={help} error={error} />
      ) : (
        <div>
          <Dropdown
            icon={icon}
            label={label}
            options={(options.length ? options : ['Choice 1', 'Choice 2']).map((o) => ({ value: o, label: o }))}
            value={text}
            onChange={onChange}
          />
          <Help text={error ? undefined : help} />
          <Problem text={error} inset />
        </div>
      );
    case 'date':
      // DateField leads with its calendar and takes no icon of its own.
      // Boxed, a date is typed DD / MM / YYYY, with Zebri's calendar a click away (user, 2026-10-15); one in the past caps at today.
      if (boxed)
        return (
          <CalendarField
            label={label}
            optional={!q.required}
            help={help}
            value={text}
            onChange={onChange}
            error={error}
            {...(q.dateEntry === 'past' ? { openYear: 1990, max: todayIso() } : {})}
          />
        );
      return (
        <div>
          <DateField label={label} value={text} onChange={onChange} error={error} draft={draft} onInvalid={onInvalid} />
          <Help text={error ? undefined : help} />
        </div>
      );
    case 'song':
      return (
        <div>
          <SongSearch label={label} value={text} onChange={onChange} />
          <Help text={error ? undefined : help} />
          <Problem text={error} inset />
        </div>
      );
    default:
      return (
        <Input
          icon={boxed ? undefined : icon}
          boxed={boxed}
          optional={boxed && !q.required}
          label={label}
          help={help}
          type={q.type === 'email' ? 'email' : q.type === 'phone' ? 'tel' : 'text'}
          inputMode={q.type === 'number' ? 'decimal' : undefined}
          // A short name is the placeholder; under a question's wording, an example time says how to write it.
          placeholder={q.type === 'time' && (boxed || isQuestion(label)) ? 'e.g. 6:30 pm' : undefined}
          value={text}
          error={error}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

/** A question's hint under a control that does not draw its own, past its icon, as `Field` puts help. */
function Help({ text }: { text: string | undefined }) {
  return text ? <p className="mt-0.5 pl-7 type-body text-zebra-400">{text}</p> : null;
}

/** What is wrong with an answer, under a control that does not draw its own error, in the error's red. */
function Problem({ text, inset = false }: { text: string | undefined; inset?: boolean }) {
  return text ? (
    <p role="alert" className={`mt-0.5 type-body text-danger ${inset ? 'pl-7' : ''}`}>
      {text}
    </p>
  ) : null;
}
