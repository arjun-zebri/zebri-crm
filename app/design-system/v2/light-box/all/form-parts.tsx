'use client';

import { useId, useState } from 'react';

import { ChipGroup } from '@/components/ui-v2/chip-group';
import { ChevronDownIcon, EyeIcon } from '@/components/ui-v2/icons';
import { PropertyChip } from '@/components/ui-v2/property-chip';

import type { FormDef, Item } from './forms-data';

/**
 * The proposed two styles, drawn from {@link FormDef}s: typed fields as a
 * name above a hairline box (text, multi-line, dropdown, date, time,
 * password, card), and properties as chips. No icon inside any box.
 * Mocks only: the dropdowns and chips do not open.
 *
 * @module app/design-system/v2/light-box/all/form-parts
 */

export const BOX =
  'rounded-button border border-zebra-200 bg-white transition-[border-color,box-shadow] duration-150 hover:border-zebra-300 focus-within:border-zebra-400 focus-within:ring-[3px] focus-within:ring-zebra-950/5 motion-reduce:transition-none';

const TEXT =
  'w-full min-w-0 bg-transparent type-body text-zebra-950 outline-none placeholder:text-zebra-400';

function Field({
  item,
}: {
  item: Extract<
    Item,
    { kind: 'text' | 'textarea' | 'select' | 'date' | 'password' | 'card' | 'time' }
  >;
}) {
  const id = useId();
  const [v, setV] = useState(item.value ?? '');
  const control = (() => {
    switch (item.kind) {
      case 'textarea':
        return (
          <textarea
            id={id}
            rows={3}
            value={v}
            onChange={(e) => setV(e.target.value)}
            className={`block resize-none px-3 py-2 ${TEXT} ${BOX}`}
          />
        );
      case 'select':
        return (
          <button
            id={id}
            type="button"
            className={`flex h-9 w-full items-center justify-between gap-2 px-3 text-left ${BOX}`}
          >
            <span className={`type-body ${item.value ? 'text-zebra-950' : 'text-zebra-400'}`}>
              {item.value ?? 'Choose'}
            </span>
            <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-zebra-400" />
          </button>
        );
      case 'password':
        return (
          <div className={`flex h-9 items-center gap-2 pl-3 pr-1 ${BOX}`}>
            <input
              id={id}
              type="password"
              value={v}
              onChange={(e) => setV(e.target.value)}
              className={`h-full ${TEXT}`}
            />
            <span
              aria-hidden="true"
              className="flex size-7 items-center justify-center text-zebra-400"
            >
              <EyeIcon className="size-4" />
            </span>
          </div>
        );
      case 'card':
        return (
          <div className={`flex h-9 items-center gap-3 px-3 ${BOX}`}>
            <input id={id} placeholder="Card number" className={`h-full flex-1 ${TEXT}`} />
            <input aria-label="Expiry" placeholder="MM / YY" className={`h-full w-16 ${TEXT}`} />
            <input aria-label="CVC" placeholder="CVC" className={`h-full w-10 ${TEXT}`} />
          </div>
        );
      default:
        return (
          <input
            id={id}
            value={v}
            placeholder={item.kind === 'date' ? '1 Jul 2026' : undefined}
            onChange={(e) => setV(e.target.value)}
            className={`block h-9 px-3 ${TEXT} ${BOX}`}
          />
        );
    }
  })();
  return (
    <div className={`space-y-1.5 ${item.half ? '' : 'sm:col-span-2'}`}>
      <label htmlFor={id} className="block type-label text-zebra-700">
        {item.label}
      </label>
      {control}
      {item.help ? <p className="type-body text-zebra-500">{item.help}</p> : null}
    </div>
  );
}

function Choice({ item }: { item: Extract<Item, { kind: 'choice' }> }) {
  const [v, setV] = useState<string[]>(item.value ?? []);
  return (
    <div className="sm:col-span-2">
      <ChipGroup
        label={item.label}
        options={item.options}
        value={v}
        onChange={setV}
        multiple={item.multiple ?? false}
      />
    </div>
  );
}

const noop = () => undefined;

type Run =
  | { chips: true; items: Extract<Item, { kind: 'chip' }>[] }
  | { chips: false; items: Exclude<Item, { kind: 'chip' }>[] };

/** Consecutive fields form one grid, consecutive chips one row, in the form's own order. */
function runs(items: Item[]): Run[] {
  const out: Run[] = [];
  for (const i of items) {
    const last = out[out.length - 1];
    if (i.kind === 'chip') {
      if (last?.chips) last.items.push(i);
      else out.push({ chips: true, items: [i] });
    } else if (last && !last.chips) last.items.push(i);
    else out.push({ chips: false, items: [i] });
  }
  return out;
}

/** One form, in the proposed styles. */
export function FormCard({ form }: { form: FormDef }) {
  return (
    <article className="space-y-5 rounded-panel bg-white p-6 shadow-btn-soft ring-1 ring-hairline">
      <header className="space-y-0.5">
        <h3 className="type-subheading text-zebra-950">{form.title}</h3>
        <p className="type-body text-zebra-500">{form.where}</p>
      </header>
      {runs(form.items).map((r, k) =>
        r.chips ? (
          <div key={k} className="-mx-2.5 flex flex-wrap gap-1">
            {r.items.map((c) => (
              <PropertyChip
                key={c.label}
                icon={c.icon}
                label={c.label}
                value={c.value}
                open={false}
                onOpenChange={noop}
              >
                {null}
              </PropertyChip>
            ))}
          </div>
        ) : (
          <div key={k} className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
            {r.items.map((i, n) =>
              i.kind === 'choice' ? <Choice key={n} item={i} /> : <Field key={n} item={i} />,
            )}
          </div>
        ),
      )}
      {form.note ? <p className="type-body text-zebra-500">{form.note}</p> : null}
      <p className="type-body text-zebra-400">pages/{form.file}</p>
    </article>
  );
}
