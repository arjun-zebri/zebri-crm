'use client';

import { useCallback, useId, useState, type CSSProperties } from 'react';

import { ColorPopover } from '@/components/ui/color-popover';
import { ChevronDownIcon } from '@/components/ui-v2/icons';

import { DISABLED, HOVER_ON_WHITE, controlClass } from './control-styles';
import { Field } from './field';

/**
 * Design system v2 colour field (preview): a swatch that opens the
 * app's colour picker (`ColorPopover`: saturation square, hue strip,
 * hex, eyedropper), beside the hex value as editable text. Either one
 * updates the other.
 *
 * `inline` is the settings-row form (the brand kit's "Main colour"): a
 * small square swatch, the hex and a chevron as one quiet trigger, like
 * an inline `Dropdown`, with the label named on the row's left instead.
 *
 * @example
 * ```tsx
 * <ColorField label="Primary colour" value={primary} onChange={setPrimary} />
 * ```
 *
 * @module components/ui-v2/color-field
 */

export interface ColorFieldProps {
  /** Visible label (read out only, with `bare`). */
  label: string;
  /** Current colour as `#rrggbb`. */
  value: string;
  /** Called with a valid `#rrggbb` colour. */
  onChange: (hex: string) => void;
  /** Quick picks shown along the top of the picker (up to six). */
  swatches?: readonly string[] | undefined;
  /**
   * Only a round swatch that opens the picker: no label above it and no
   * hex field beside it (the picker has its own). For a row that
   * already names it on the left, as a run sheet moment's "Colour"
   * does; the label is still read out.
   */
  bare?: boolean | undefined;
  /** The settings-row trigger: swatch, hex and chevron, no label above; the label is read out. */
  inline?: boolean | undefined;
  /** Greys the field out; the swatch cannot be opened nor the hex typed. */
  disabled?: boolean | undefined;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** v2 colour field. See {@link ColorFieldProps}. */
export function ColorField({ label, value, onChange, swatches, bare = false, inline = false, disabled = false }: ColorFieldProps) {
  const id = useId();
  // The text is its own state so a half-typed "#2f5" can sit there
  // without being rejected; only a complete hex is passed up.
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  // Inside a modal <dialog>, the picker portals into it (as Dropdown's list
  // does), since the dialog's top layer covers anything portalled to the body.
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  const findDialog = useCallback(
    (el: HTMLButtonElement | null) => setDialog(el?.closest('dialog') ?? null),
    [],
  );
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }
  function onText(next: string) {
    setText(next);
    if (HEX.test(next)) onChange(next.toLowerCase());
  }
  // The app's own picker (saturation square, hue strip, hex, eyedropper),
  // not the browser's, so choosing a colour looks the same everywhere.
  const picker = (
    <ColorPopover
      value={value}
      swatches={swatches ?? []}
      onChange={(hex) => onChange(hex.toLowerCase())}
      container={dialog}
      trigger={
        inline ? (
          <button
            ref={findDialog}
            type="button"
            disabled={disabled}
            aria-label={label}
            // The inline Dropdown's trigger, so the rows of a settings list line up as one kind of control.
            className="inline-flex h-7 items-center gap-2 rounded-check px-1.5 type-code uppercase text-zebra-950 transition-colors duration-150 hover:bg-hover data-[state=open]:bg-pressed focus-mark disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none"
          >
            <span style={{ '--swatch': value } as CSSProperties} className="size-4 rounded-check bg-[var(--swatch)] ring-1 ring-inset ring-hairline" />
            {value}
            <ChevronDownIcon aria-hidden="true" className="size-4 text-zebra-500" />
          </button>
        ) : (
        <button
          ref={findDialog}
          type="button"
          disabled={disabled}
          aria-label={bare ? label : `${label} picker`}
          className={`flex shrink-0 items-center justify-center border border-hairline bg-field p-1 transition-colors duration-150 ${HOVER_ON_WHITE} focus-mark ${DISABLED} motion-reduce:transition-none ${
            bare ? 'size-8 rounded-pill' : 'h-9 w-10 rounded-panel'
          }`}
        >
          <span
            style={{ '--swatch': value } as CSSProperties}
            className={`size-full bg-[var(--swatch)] ${bare ? 'rounded-pill' : 'rounded-check'}`}
          />
        </button>
        )
      }
    />
  );
  if (bare || inline) return picker;
  return (
    <Field id={id} label={label}>
      <div className="flex gap-2">
        {picker}
        <input
          id={id}
          value={text}
          spellCheck={false}
          disabled={disabled}
          onChange={(e) => onText(e.target.value)}
          className={`${controlClass(!HEX.test(text))} h-9 type-code uppercase`}
        />
      </div>
    </Field>
  );
}
