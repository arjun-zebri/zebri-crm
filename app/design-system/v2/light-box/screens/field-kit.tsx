'use client';

import { createContext, use, useId, useState, type ReactNode } from 'react';

import { Backdrop } from '@/components/ui-v2/backdrop';
import { ChevronDownIcon, EyeIcon } from '@/components/ui-v2/icons';

/**
 * Field directions for the full-size screens (2026-10-15, after boxed
 * inputs were judged "so old school"). One `F` API, drawn in whichever
 * direction the page's switcher picks:
 *
 * - `ledger`: Attio / Notion. Each field is a row, name on the left in
 *   grey, the value on the right as plain text, no lines at all (user,
 *   2026-10-15: "too many borders"); the whole row tints on hover, with
 *   rounded corners, and is the target. Groups are held apart by space. The same shape as a
 *   client's Overview, so forms and records become one style.
 * - `inset`: Apple Settings. Fields are rows inside a soft grouped panel,
 *   name left in black, value right-aligned in grey.
 * - `float`: Apple ID / Stripe Checkout. A tall soft well, no border,
 *   the name small inside it at the top and the value under it.
 * - `boxed`: the rejected hairline box, kept to compare.
 *
 * (The conversational direction is New client's own layout, in
 * `screens.tsx`.) Mocks only.
 *
 * @module app/design-system/v2/light-box/screens/field-kit
 */

export type Direction = 'ledger' | 'inset' | 'float' | 'boxed';
export const DirectionContext = createContext<Direction>('ledger');
/** Whether the screens show their empty state (nothing typed yet), where fields are hardest to read. */
export const EmptyContext = createContext(true);

const TEXT =
  'w-full min-w-0 bg-transparent type-body text-zebra-950 outline-none placeholder:text-zebra-400';
const BOX =
  'rounded-button border border-zebra-200 bg-field shadow-[0_1px_2px_rgb(11_11_10/0.05)] transition-[border-color,box-shadow] duration-150 hover:border-zebra-300 focus-within:border-zebra-400 focus-within:ring-4 focus-within:ring-zebra-950/[0.06]';

export interface FieldProps {
  label: string;
  value?: string | undefined;
  placeholder?: string | undefined;
  help?: string | undefined;
  type?: string | undefined;
  aside?: ReactNode | undefined;
  /** What an empty row says in the boxless directions, when "Add <name>" would read wrong (log in). */
  prompt?: string | undefined;
  kind?: 'text' | 'select' | 'textarea' | 'password' | undefined;
  rows?: number | undefined;
  className?: string | undefined;
}

/** The bare control (input, textarea, or a select trigger) in the direction's text alignment. */
function Control({
  id,
  p,
  align = 'left',
  boxed = false,
}: {
  id: string;
  p: FieldProps;
  align?: 'left' | 'right';
  boxed?: boolean;
}) {
  const [v, setV] = useState(p.value ?? '');
  const right = align === 'right' ? ' text-right' : '';
  if (p.kind === 'select') {
    return (
      <button
        id={id}
        type="button"
        className={`flex w-full items-center gap-1.5 ${align === 'right' ? 'justify-end' : 'justify-between'} ${boxed ? `h-9 px-3 ${BOX}` : ''}`}
      >
        <span className={`type-body ${p.value ? 'text-zebra-950' : 'text-zebra-400'}`}>
          {p.value || p.placeholder || 'Choose'}
        </span>
        <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-zebra-400" />
      </button>
    );
  }
  if (p.kind === 'textarea') {
    return (
      <textarea
        id={id}
        rows={p.rows ?? 3}
        value={v}
        placeholder={p.placeholder}
        onChange={(e) => setV(e.target.value)}
        className={`block resize-none ${TEXT} ${boxed ? `px-3 py-2 ${BOX}` : ''}`}
      />
    );
  }
  return (
    <div className={`flex items-center ${boxed ? `h-9 pl-3 pr-1 ${BOX}` : ''}`}>
      <input
        id={id}
        type={p.kind === 'password' ? 'password' : p.type}
        value={v}
        placeholder={p.placeholder}
        onChange={(e) => setV(e.target.value)}
        className={`${TEXT}${right}`}
      />
      {p.kind === 'password' ? (
        <EyeIcon aria-hidden="true" className="ml-2 size-4 shrink-0 text-zebra-400" />
      ) : null}
    </div>
  );
}

/** One field, drawn in the current direction. */
export function F(props: FieldProps) {
  const d = use(DirectionContext);
  const empty = use(EmptyContext);
  const id = useId();
  // With no box, an empty value must still say "type here": a verb in the
  // quiet grey ("Add phone", "Choose"), never an example that could pass
  // for a real value.
  const boxless = d === 'ledger' || d === 'inset';
  const p: FieldProps = {
    ...props,
    value: empty ? '' : props.value,
    placeholder: boxless
      ? (props.prompt ?? (props.kind === 'select' ? 'Choose' : `Add ${props.label.toLowerCase()}`))
      : props.placeholder,
  };
  const help = p.help ? <p className="type-body text-zebra-500">{p.help}</p> : null;
  if (d === 'ledger') {
    return (
      <div className="group grid grid-cols-[9.5rem_minmax(0,1fr)] items-start gap-x-4 rounded-button px-3 py-2 transition-colors duration-150 hover:bg-hover focus-within:bg-hover">
        <label htmlFor={id} className="pt-px type-body text-zebra-500">
          {p.label}
        </label>
        <div className="space-y-0.5">
          <Control key={String(empty)} id={id} p={p} />
          {help}
        </div>
      </div>
    );
  }
  if (d === 'inset') {
    const tall = p.kind === 'textarea';
    return (
      <div
        className={`border-b border-hairline px-4 last:border-b-0 ${tall ? 'space-y-1 py-3' : 'flex min-h-11 items-center gap-4 py-2'}`}
      >
        <label
          htmlFor={id}
          className={`shrink-0 type-body text-zebra-950 ${tall ? 'block' : 'w-40'}`}
        >
          {p.label}
        </label>
        <div className="min-w-0 flex-1 [&_input]:text-zebra-600 [&_textarea]:text-zebra-600">
          <Control key={String(empty)} id={id} p={p} align={tall ? 'left' : 'right'} />
        </div>
      </div>
    );
  }
  if (d === 'float') {
    return (
      <div className={`space-y-1.5 ${p.className ?? ''}`}>
        <label
          htmlFor={id}
          className="block cursor-text rounded-panel bg-zebra-100 px-3.5 pb-2 pt-2 transition-colors duration-150 hover:bg-zebra-200/60 focus-within:bg-field focus-within:shadow-[0_0_0_1.5px_var(--color-zebra-950)]"
        >
          <span className="flex items-baseline justify-between type-body text-zebra-500">
            {p.label}
            {p.aside}
          </span>
          <Control key={String(empty)} id={id} p={p} />
        </label>
        {help}
      </div>
    );
  }
  return (
    <div className={`space-y-1.5 ${p.className ?? ''}`}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="type-label text-zebra-900">
          {p.label}
        </label>
        {p.aside}
      </div>
      <Control key={String(empty)} id={id} p={p} boxed />
      {help}
    </div>
  );
}

/** A titled group of fields, laid out for the current direction. */
export function Group({
  title,
  why,
  children,
}: {
  title?: string;
  why?: string;
  children: ReactNode;
}) {
  const d = use(DirectionContext);
  const head = !title ? null : (
    <div className="space-y-0.5">
      <h3 className={d === 'inset' ? 'px-4 type-body text-zebra-500' : 'type-label text-zebra-950'}>
        {title}
      </h3>
      {why && d !== 'inset' ? <p className="max-w-xl type-body text-zebra-500">{why}</p> : null}
    </div>
  );
  if (d === 'ledger') {
    return (
      <section className="space-y-3">
        {head}
        <div className="-mx-3">{children}</div>
      </section>
    );
  }
  if (d === 'inset') {
    return (
      <section className="space-y-2">
        {head}
        <div className="overflow-hidden rounded-panel bg-zebra-50 ring-1 ring-hairline">
          {children}
        </div>
        {why ? <p className="px-4 type-body text-zebra-500">{why}</p> : null}
      </section>
    );
  }
  return (
    <section
      className={`space-y-5 ${d === 'boxed' ? 'border-t border-hairline pt-8 first:border-t-0 first:pt-0' : ''}`}
    >
      {head}
      <div className={`grid gap-x-3 sm:grid-cols-2 ${d === 'float' ? 'gap-y-3' : 'gap-y-5'}`}>
        {children}
      </div>
    </section>
  );
}

/** A screen on the app's backdrop, dimmed when it shows a dialog, at real size. */
export function Stage({
  title,
  note,
  dim = false,
  children,
}: {
  title: string;
  note: string;
  dim?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h2 className="type-heading text-zebra-950">{title}</h2>
        <p className="max-w-3xl type-body text-zebra-500">{note}</p>
      </div>
      <div className="relative isolate flex min-h-[52rem] items-center justify-center overflow-hidden rounded-panel p-4 sm:p-8">
        <Backdrop contained dim={dim} />
        {children}
      </div>
    </section>
  );
}

/** A dialog card at a real dialog size. */
export function DialogCard({ size, children }: { size: 'lg' | 'split'; children: ReactNode }) {
  return (
    <div
      className={`flex w-full max-w-[56rem] flex-col overflow-hidden rounded-panel bg-field text-zebra-950 shadow-xl ring-1 ring-hairline ${size === 'lg' ? 'h-[46rem]' : 'h-[37rem]'}`}
    >
      {children}
    </div>
  );
}
