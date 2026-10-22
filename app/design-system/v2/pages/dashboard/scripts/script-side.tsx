'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ROW } from '@/components/ui-v2/control-styles';
import { GroupLabel } from '@/components/ui-v2/group-label';
import { PlusIcon, PrinterIcon } from '@/components/ui-v2/icons';

import { NOT_GIVEN } from '../questionnaires/read-back';

import { FIELD_GROUPS, type ScriptField } from './scripts-data';

/**
 * The script's side panel, beside the writing under the dialog's header:
 * what Zebri knows about the client, under group labels by where it
 * comes from (client, event, their answers, people on the day), each one press to drop into the page where the cursor is (it
 * then prints as the answer). Each row tints and shows a + on hover, so
 * it reads as something to add, not a fact sheet. Only details with an
 * answer are listed; the rest wait behind one line ("3 not answered
 * yet"), and can go in anyway: they fill themselves in once answered.
 * Each row is on the read-back grid (a 9rem quiet label, the value
 * after it, "Not given" for one not answered yet); a question is too
 * long for the label column, so an answer's row puts the question above
 * it. At the foot, one button: the print window both prints and saves a
 * PDF. A hairline on its left: the writing is white too, so nothing
 * else would separate them.
 *
 * @module app/design-system/v2/pages/dashboard/scripts/script-side
 */

export interface ScriptSideProps {
  fields: ScriptField[];
  onInsert: (field: ScriptField) => void;
  /** The page has nothing in it to print yet. */
  empty: boolean;
  onPrint: () => void;
  /** @deprecated Close is the dialog header's now (2026-10-14); ignored, kept so callers compile. */
  onClose?: (() => void) | undefined;
}

/** The side panel. See {@link ScriptSideProps}. */
export function ScriptSide({ fields, onInsert, empty, onPrint }: ScriptSideProps) {
  const [open, setOpen] = useState(false);
  const missing = fields.filter((f) => !f.value).length;
  return (
    <aside aria-label="Their details" className="flex shrink-0 flex-col border-t border-hairline lg:w-[22rem] lg:border-l lg:border-t-0">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 max-lg:max-h-72 sm:px-8 sm:pt-10">
        <p className="pb-5 type-body text-zebra-500">Their details. Click one to add it where you are writing.</p>
        <div className="space-y-5">
          {FIELD_GROUPS.map((g) => {
            const rows = fields.filter((f) => f.group === g.id && (f.value || open));
            return rows.length ? (
              <section key={g.id} aria-label={g.title}>
                <GroupLabel as="h3" className="pb-1">
                  {g.title}
                </GroupLabel>
                <ul className="-mx-3 space-y-0.5">
                  {rows.map((f) => (
                    <FieldRow key={f.id} field={f} onInsert={onInsert} />
                  ))}
                </ul>
              </section>
            ) : null;
          })}
          {missing > 0 ? (
            <Button variant="plain" onClick={() => setOpen((o) => !o)}>
              {open ? 'Hide the ones not answered' : `${missing} not answered yet`}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="flex justify-end px-6 pb-6 sm:px-8 sm:pb-8">
        <Button icon={<PrinterIcon aria-hidden="true" className="size-4" />} onClick={onPrint} disabled={empty}>
          Print or save PDF
        </Button>
      </div>
    </aside>
  );
}

/** One detail: its name, its answer and, on hover, a +. Pressing keeps the page's cursor. */
function FieldRow({ field: f, onInsert }: { field: ScriptField; onInsert: (field: ScriptField) => void }) {
  const stacked = f.group === 'answers';
  return (
    <li>
      <button
        type="button"
        aria-label={`Add ${f.label}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onInsert(f)}
        className={`group grid w-full items-center gap-x-4 rounded-button px-3 py-1.5 text-left type-body ${ROW} ${
          stacked ? 'grid-cols-[minmax(0,1fr)_1rem]' : 'grid-cols-[minmax(0,9rem)_minmax(0,1fr)_1rem]'
        }`}
      >
        <span className={stacked ? 'min-w-0' : 'contents'}>
          <span className={`block text-zebra-500 ${stacked ? '' : 'truncate'}`}>{f.label}</span>
          <span className={`block truncate ${f.value ? 'text-zebra-950' : 'text-zebra-400'}`}>{f.value ?? NOT_GIVEN}</span>
        </span>
        <PlusIcon
          aria-hidden="true"
          className="size-4 text-zebra-600 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
        />
      </button>
    </li>
  );
}
