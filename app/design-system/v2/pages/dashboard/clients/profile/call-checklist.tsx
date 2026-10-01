'use client';

import { Plus, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Checkbox } from '@/components/ui-v2/checkbox';
import { InlineInput } from '@/components/ui-v2/inline-input';

/**
 * What the MC wants to cover on the next call. Before the call it is a
 * list to shape: Zebri starts it from what is still open with the
 * client, and the MC adds or removes lines. During the call the same
 * lines become checkboxes to tick off as each thing is covered. Anything
 * left unticked when the call ends carries over to the next one.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/call-checklist
 */

export interface CallChecklistProps {
  items: string[];
  /** Before the call: edit the list. */
  onItems?: ((items: string[]) => void) | undefined;
  /** During the call: what is ticked, and ticking one. */
  checked?: string[] | undefined;
  onTick?: ((item: string) => void) | undefined;
}

/** The checklist. See {@link CallChecklistProps}. */
export function CallChecklist({ items, onItems, checked, onTick }: CallChecklistProps) {
  const live = onTick !== undefined;
  const done = items.filter((i) => checked?.includes(i)).length;
  return (
    <section aria-labelledby="call-checklist" className="space-y-4">
      <div className="flex items-baseline gap-3">
        <h3 id="call-checklist" className="type-label font-semibold text-zebra-950">
          {live ? 'Checklist' : 'For the next call'}
        </h3>
        {live && items.length ? (
          <span className="type-body tabular-nums text-zebra-500">
            {done} of {items.length}
          </span>
        ) : null}
      </div>
      {live ? null : (
        <p className="type-body text-zebra-500">
          Started from what is still open. Tick each one off during the call.
        </p>
      )}
      {live ? (
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={i}>
              <Checkbox
                label={<span className={checked?.includes(i) ? 'text-zebra-400 line-through' : ''}>{i}</span>}
                checked={checked?.includes(i) ?? false}
                onChange={() => onTick(i)}
              />
            </li>
          ))}
          {items.length ? null : <li className="type-body text-zebra-500">Nothing on the list.</li>}
        </ul>
      ) : (
        <PlanList items={items} onItems={onItems ?? (() => undefined)} />
      )}
    </section>
  );
}

/** The list before the call: each line with a remove button, then a line to add one. */
function PlanList({ items, onItems }: { items: string[]; onItems: (items: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const item = draft.trim();
    if (item && !items.includes(item)) onItems([...items, item]);
    setDraft('');
  };
  return (
    <ul className="space-y-1">
      {items.map((i) => (
        <li key={i} className="group flex items-center gap-3">
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-pill bg-zebra-300" />
          <span className="min-w-0 flex-1 type-body text-zebra-950">{i}</span>
          {/* -mr-2 puts the glyph on the column's right edge. */}
          <Button
            variant="ghost"
            square
            aria-label={`Remove ${i}`}
            className="-mr-2"
            onClick={() => onItems(items.filter((x) => x !== i))}
          >
            <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
          </Button>
        </li>
      ))}
      <li className="flex h-9 items-center gap-3">
        <Plus aria-hidden="true" strokeWidth={1.5} className="-ml-[0.3125rem] size-4 shrink-0 text-zebra-400" />
        <form
          className="min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <InlineInput
            aria-label="Add to the checklist"
            placeholder="Add something to cover"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={add}
            className="w-full type-body"
          />
        </form>
      </li>
    </ul>
  );
}
