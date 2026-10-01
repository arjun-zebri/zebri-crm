'use client';

import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { useCallback, useId, useState, type CSSProperties } from 'react';

import { FLOATING, MENU_ITEM, controlClass } from './control-styles';
import { Field } from './field';

/**
 * Design system v2 dropdown (preview): a pick-one list in a custom
 * floating menu, for when each option has to be shown, not just named.
 * Fonts are the case in point: `fontFamily` renders an option (and the
 * trigger, once picked) in its own face, which the native {@link Select}
 * cannot do. For plain text options, prefer `Select`.
 *
 * Built on Radix Select, so keyboard, type-to-search and screen readers
 * behave like a real select. The trigger has the v2 control look (32px,
 * grass focus halo); the menu is a white panel with the floating shadow,
 * the pick marked with a check.
 *
 * `inline` drops the label row and the control box for a pick made in the
 * middle of a sentence ("Popular with MC ⌄"): the trigger is the value in
 * label weight with a chevron, a soft tint on hover and while open, sized
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
}

// Font stacks are data, so they ride in on a custom property (the one
// `style`) and a class reads it.
const face = (fontFamily: string | undefined) =>
  fontFamily ? ({ '--dd-font': fontFamily } as CSSProperties) : undefined;
const FACE_CLASS = 'font-[family-name:var(--dd-font)]';

const BOX_TRIGGER =
  `${controlClass(false)} flex h-9 cursor-pointer items-center justify-between gap-2 text-left ` +
  'data-[state=open]:border-grass-600 data-[state=open]:shadow-[0_0_0_3px_var(--color-grass-100)]';
// Hover and open are a colour step only, like every v2 control.
const INLINE_TRIGGER =
  'inline-flex h-7 cursor-pointer items-center gap-1 rounded-check px-1.5 type-label text-zebra-950 ' +
  'transition-colors duration-150 hover:bg-zebra-950/5 data-[state=open]:bg-zebra-950/5 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 motion-reduce:transition-none';

/** v2 dropdown. See {@link DropdownProps}. */
export function Dropdown({ label, options, value, onChange, inline = false }: DropdownProps) {
  const id = useId();
  const current = options.find((o) => o.value === value);
  // The dialog the trigger sits in, if any: the menu's portal target.
  const [dialog, setDialog] = useState<HTMLElement | null>(null);
  const findDialog = useCallback((el: HTMLButtonElement | null) => setDialog(el?.closest('dialog') ?? null), []);
  const select = (
    <RadixSelect.Root value={value} onValueChange={onChange}>
      <RadixSelect.Trigger
        ref={findDialog}
        id={id}
        aria-label={inline ? label : undefined}
        className={inline ? INLINE_TRIGGER : BOX_TRIGGER}
      >
        <span style={face(current?.fontFamily)} className={`min-w-0 truncate ${current?.fontFamily ? FACE_CLASS : ''}`}>
          <RadixSelect.Value />
        </span>
        <RadixSelect.Icon asChild>
          <ChevronDown aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0 text-zebra-500" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal container={dialog ?? undefined}>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          collisionPadding={16}
          // An inline trigger is only as wide as its word, so the menu keeps a floor.
          // The same surface as a Popover menu; the padding sits on the viewport so it scrolls inside it.
          className={`${FLOATING} max-h-[min(22rem,var(--radix-select-content-available-height))] min-w-[max(9rem,var(--radix-select-trigger-width))] overflow-hidden rounded-button`}
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
                  <Check aria-hidden="true" strokeWidth={1.5} className="size-4 text-grass-700" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
  return inline ? select : <Field id={id} label={label}>{select}</Field>;
}
