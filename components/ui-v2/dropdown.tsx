'use client';

import * as RadixSelect from '@radix-ui/react-select';
import { useCallback, useId, useState, type ComponentType, type CSSProperties } from 'react';

import { CheckIcon, ChevronDownIcon } from '@/components/ui-v2/icons';

import { BoxedLabel } from './boxed-label';
import { boxedControl, DISABLED, FLOATING, LEDGER_ROW, MENU_ITEM, controlClass } from './control-styles';
import { Field, describedBy } from './field';
import { FIT_TINT } from './fit-input';

/**
 * Design system v2 dropdown (preview): a pick-one list in a custom
 * floating menu, for when each option has to be shown, not just named.
 * Fonts are the case in point: `fontFamily` renders an option (and the
 * trigger, once picked) in its own face, which the native {@link Select}
 * cannot do. For plain text options, prefer `Select`.
 *
 * Built on Radix Select, so keyboard, type-to-search and screen readers
 * behave like a real select. The trigger has the v2 control look (36px,
 * boxless; `raised` gives the toolbar look, white with the panel's
 * corners, beside raised buttons) and takes the focus mark, being a
 * button, not a text field; the menu is a white panel with the floating
 * shadow, the pick marked with a check in the `selected` green.
 *
 * `inline` drops the label row and the control box for a pick made in the
 * middle of a sentence ("Popular with MC ⌄"): the trigger is the value in
 * label weight with a chevron, the `hover` tint on hover and `pressed` while open, sized
 * to its text. `label` then names it for screen readers only.
 *
 * Inside a modal `<dialog>` the menu portals into that dialog rather than
 * `<body>`: the browser makes everything outside an open modal inert, so
 * a menu on `<body>` would open behind it and ignore every click.
 *
 * @example
 * ```tsx
 * <Dropdown
 *   label="Heading font"
 *   value={font}
 *   onChange={setFont}
 *   options={[{ value: 'Fraunces', label: 'Fraunces', fontFamily: '"Fraunces", serif' }]}
 * />
 * <Dropdown inline label="Role" value={role} onChange={setRole} options={roles} />
 * ```
 *
 * @module components/ui-v2/dropdown
 */

/** One option: its value, visible name, and an optional face to show it in. */
export interface DropdownOption {
  value: string;
  label: string;
  /** A CSS font-family stack; the option and trigger render in it. */
  fontFamily?: string | undefined;
}

export interface DropdownProps {
  /** Visible label above the trigger; with `inline`, its accessible name only. */
  label: string;
  options: readonly DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  /** Borderless trigger sized to its value, for use inside a line of text. */
  inline?: boolean | undefined;
  /** A soft grey well instead of no box, as `Input`'s `filled`. Ignored with `inline`. */
  filled?: boolean | undefined;
  /** The toolbar look: white, padded, the panel's corners and the buttons' lift. Ignored with `inline`. */
  raised?: boolean | undefined;
  /** Greys the trigger out; it cannot be opened. */
  disabled?: boolean | undefined;
  /** In a form: the glyph leading the row, as on every v2 text field. */
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }> | undefined;
  /**
   * A ledger row, as `Input`'s `row` (user ruling 2026-10-15): the name in
   * grey on the left, the pick beside it as plain text with a chevron
   * ("Choose" while empty), no box; the row tints on hover and while
   * open. `icon` is ignored.
   */
  row?: boolean | undefined;
  /**
   * The boxed field, as `Input`'s `boxed`: the name over a white hairline
   * box, the pick inside it ("Choose" while empty) with the chevron at
   * the box's right edge, `help` and `error` under it. For the entry
   * screens and the couple's public form. `icon` is ignored.
   */
  boxed?: boolean | undefined;
  /** With `boxed`: "(optional)" after the name (see `BoxedLabel`). */
  optional?: boolean | undefined;
  /** With `boxed`: a line under the box. */
  help?: string | undefined;
  /** With `boxed`: what is wrong with the pick, in red under the box; sets `aria-invalid`. */
  error?: string | undefined;
}

// Font stacks are data, so they ride in on a custom property (the one
// `style`) and a class reads it.
const face = (fontFamily: string | undefined) =>
  fontFamily ? ({ '--dd-font': fontFamily } as CSSProperties) : undefined;
const FACE_CLASS = 'font-[family-name:var(--dd-font)]';

// In a form the trigger is a fitted field (user ruling, 2026-10-14): the
// value's words with the fitted tint, the chevron after them, the field's
// name in grey until something is picked.
const FIT_TRIGGER = `inline-flex h-9 min-w-0 max-w-full cursor-pointer items-center gap-1.5 px-2 text-left type-body text-zebra-950 data-[placeholder]:text-zebra-400 ${FIT_TINT} focus-mark ${DISABLED}`;

// No open-state border or halo: the menu under it already says it is open.
const boxTrigger = (filled: boolean, raised: boolean) =>
  `${controlClass(false, raised, filled)}${raised ? ' shadow-btn-soft' : ''} flex h-9 cursor-pointer items-center justify-between gap-2 text-left focus-mark ${DISABLED}`;
/**
 * The inline trigger: a word in a sentence that opens a pick. Hover and
 * open are a colour step only, like every v2 control. At least 28px, so a
 * long value can wrap to a second line. Exported for a picker that opens
 * something other than a list (Journeys' When) so it looks the same.
 */
export const INLINE_TRIGGER =
  'inline-flex min-h-7 min-w-0 cursor-pointer items-center gap-1 rounded-check px-1.5 py-0.5 text-left type-label text-zebra-950 ' +
  'transition-colors duration-150 hover:bg-hover data-[state=open]:bg-pressed ' +
  `focus-mark ${DISABLED} motion-reduce:transition-none`;

/** A row's trigger: plain text the width of the value column, the chevron after the words. */
const ROW_TRIGGER = `flex w-full min-w-0 cursor-pointer items-center gap-1.5 text-left type-body text-zebra-950 outline-none data-[placeholder]:text-zebra-400 ${DISABLED}`;

/** A boxed trigger: the box, the pick on the left, the chevron at the right edge. */
const boxedTrigger = (error: boolean) =>
  `${boxedControl(error)} flex cursor-pointer items-center justify-between gap-2 text-left data-[placeholder]:text-zebra-400${error ? '' : ' data-[state=open]:border-zebra-400'}`;

/** v2 dropdown. See {@link DropdownProps}. */
export function Dropdown({
  label,
  options,
  value,
  onChange,
  inline = false,
  filled = false,
  raised = false,
  disabled = false,
  icon: Icon,
  row = false,
  boxed = false,
  optional = false,
  help,
  error,
}: DropdownProps) {
  const id = useId();
  const current = options.find((o) => o.value === value);
  // The dialog the trigger sits in, if any: the menu's portal target.
  const [dialog, setDialog] = useState<HTMLElement | null>(null);
  const findDialog = useCallback(
    (el: HTMLButtonElement | null) => setDialog(el?.closest('dialog') ?? null),
    [],
  );
  const select = (
    <RadixSelect.Root value={value} onValueChange={onChange} disabled={disabled}>
      <RadixSelect.Trigger
        ref={findDialog}
        id={id}
        aria-label={inline ? label : undefined}
        aria-invalid={boxed && error ? true : undefined}
        aria-describedby={boxed ? describedBy(id, help, error) : undefined}
        className={
          inline
            ? INLINE_TRIGGER
            : boxed
              ? boxedTrigger(Boolean(error))
              : row
              ? ROW_TRIGGER
              : filled || raised
                ? boxTrigger(filled, raised)
                : FIT_TRIGGER
        }
      >
        <span
          style={face(current?.fontFamily)}
          className={`min-w-0 truncate ${current?.fontFamily ? FACE_CLASS : ''}`}
        >
          <RadixSelect.Value placeholder={inline ? undefined : row || boxed ? 'Choose' : label} />
        </span>
        <RadixSelect.Icon asChild>
          <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-zebra-500" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal container={dialog ?? undefined}>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          collisionPadding={16}
          // An inline trigger is only as wide as its word, so the menu keeps a floor.
          // The same surface as a Popover menu; the padding sits on the viewport so it scrolls inside it.
          className={`${FLOATING} max-h-[min(22rem,var(--radix-select-content-available-height))] min-w-[max(9rem,var(--radix-select-trigger-width))] overflow-hidden rounded-panel`}
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((o) => (
              <RadixSelect.Item
                key={o.value}
                value={o.value}
                style={face(o.fontFamily)}
                className={`${MENU_ITEM} data-[state=checked]:text-zebra-950 ${o.fontFamily ? FACE_CLASS : ''}`}
              >
                <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="ml-auto">
                  <CheckIcon aria-hidden="true" className="size-4 text-selected" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
  if (inline) return select;
  if (boxed)
    return (
      <div>
        <BoxedLabel htmlFor={id} optional={optional}>
          {label}
        </BoxedLabel>
        {select}
        {/* As a boxed Input: an error takes the help's place on screen. */}
        {help ? (
          <p id={`${id}-help`} className={error ? 'sr-only' : 'mt-1.5 type-body text-zebra-500'}>
            {help}
          </p>
        ) : null}
        {error ? (
          <p id={`${id}-error`} role="alert" className="mt-1.5 type-body text-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  if (row) {
    return (
      <div className={`${LEDGER_ROW} has-[[data-state=open]]:bg-hover`}>
        <label htmlFor={id} className="type-body text-zebra-500">
          {label}
        </label>
        {select}
      </div>
    );
  }
  if (filled || raised)
    return (
      <Field id={id} label={label}>
        {select}
      </Field>
    );
  return (
    <Field id={id} label={label} indent={Boolean(Icon)}>
      <div className={`flex min-h-9 items-center gap-1${Icon ? '' : ' -ml-2'}`}>
        {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0 text-zebra-400" /> : null}
        {select}
      </div>
    </Field>
  );
}
