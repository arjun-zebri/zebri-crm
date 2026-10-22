'use client';

import { Button } from '@/components/ui-v2/button';
import { PlusIcon, TrashIcon } from '@/components/ui-v2/icons';
import { Tooltip } from '@/components/ui-v2/tooltip';
import { InlineField, InlineNumber, plainText, type RichDoc } from '@/features/proposals';

import { LineItemsView } from '../doc-types/invoice/line-items-view';
import { lineItemsData, lineItemsOf, newLine } from '../doc-types/invoice/lines';
import type { DocSection, LineItem, LineItemsData, LineItemsWord } from '../model/types';
import { useDocFields } from '../sections/parts/parts';
import type { DocEditor } from '../state/use-doc-editor';

/**
 * An invoice's lines block while editing, as flexible as the rest of the
 * page (founder, 2026-10-21: "can't even add more lines"): every word
 * typed in place with the invoice's `@` fields; Add a line under them,
 * each new line with words and an amount of its own (a travel fee, an
 * extra hour) and a bin on hover; and the totals and GST worked out from
 * the lines as the MC types. This payment's line keeps its amount, worked
 * out from the booking, and cannot be removed: it is what the invoice is
 * for. Which lines show is the bar's Show menu
 * (`section-bar/line-items-options.tsx`).
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/line-items-edit
 */

/** What each heading or total says while empty. */
const HINT: Record<LineItemsWord, string> = {
  description: 'Heading',
  amount: 'Heading',
  subtotal: 'Before GST',
  gst: 'GST',
  total: 'Total',
};

/** The largest amount a line takes, in dollars. */
const MAX = 100000;

export interface LineItemsEditProps {
  section: DocSection;
  builder: DocEditor;
  /** Production's editor state version, which tells each field's editor when the layout changed under it (undo). */
  externalVersion: number;
}

/** The edit form. See {@link LineItemsEditProps}. */
export function LineItemsEdit({ section, builder, externalVersion }: LineItemsEditProps) {
  const fields = useDocFields();
  const lines = lineItemsOf(section);
  const write = (patch: Partial<LineItemsData>, commit = false) =>
    builder.dispatch({ type: 'setData', id: section.id, data: { kind: 'lineItems', lineItems: { ...lineItemsData(section), ...patch } } }, commit ? { commit } : undefined);
  const setItem = (id: string, patch: Partial<LineItem>, commit = false) => write({ items: lines.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }, commit);
  const select = () => builder.select(section.id);
  const field = (value: RichDoc, placeholder: string, onChange: (doc: RichDoc) => void, className = '') => (
    <InlineField value={value} placeholder={placeholder} singleLine className={className} externalVersion={externalVersion} onFocus={select} onChange={onChange} variables={fields?.list} />
  );
  const ctx = { branding: builder.branding, theme: builder.theme, mode: 'edit' as const, values: fields?.values ?? {}, textColor: section.style.textColor, align: section.style.align };
  return (
    <LineItemsView
      lines={lines}
      theme={builder.theme}
      ctx={ctx}
      edit={{
        word: (key) => field(lines.words[key], HINT[key], (doc) => write({ words: { ...lineItemsData(section).words, [key]: doc } }), key === 'amount' ? '[&_p]:text-right' : ''),
        text: (item) => field(item.text, 'What it is for', (text) => setItem(item.id, { text })),
        detail: (item) => field(item.detail ?? { type: 'doc', content: [] }, 'Add a detail', (detail) => setItem(item.id, { detail: plainText(detail).trim() ? detail : undefined })),
        amount: (item, figure) =>
          item.amount === null ? (
            // This payment's amount is the booking's, not typed.
            <Tooltip side="top" label="Worked out from the booking">
              <span className="rounded-check bg-grass-500/15 px-[0.2em]">{figure}</span>
            </Tooltip>
          ) : (
            // It draws its own "$".
            <InlineNumber value={item.amount} label="Amount for this line" max={MAX} onFocus={select} onCommit={(amount) => setItem(item.id, { amount }, true)} className="justify-end [&_input]:text-right" />
          ),
        remove: (item) =>
          item.amount === null ? null : (
            <span className="absolute -right-12 top-3 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover/line:opacity-100 motion-reduce:transition-none">
              <Button variant="ghost" square aria-label="Remove line" onClick={() => write({ items: lines.items.filter((i) => i.id !== item.id) }, true)}>
                <TrashIcon aria-hidden="true" className="size-4" />
              </Button>
            </span>
          ),
        add: (
          <div className="pt-3">
            <Button variant="ghost" icon={<PlusIcon aria-hidden="true" className="size-4" />} onClick={() => write({ items: [...lines.items, newLine()] }, true)}>
              Add a line
            </Button>
          </div>
        ),
      }}
    />
  );
}
