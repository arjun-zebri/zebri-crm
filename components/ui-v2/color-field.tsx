'use client';

import { useCallback, useId, useState, type CSSProperties } from 'react';

import { ColorPopover } from '@/components/ui/color-popover';

import { controlClass } from './control-styles';
import { Field } from './field';

/**
 * Design system v2 colour field (preview): a swatch that opens the
 * app's colour picker (`ColorPopover`: saturation square, hue strip,
 * hex, eyedropper), beside the hex value as editable text. Either one
 * updates the other.
 *
 * @example
 * ```tsx
 * <ColorField label="Primary colour" value={primary} onChange={setPrimary} />
 * ```
 *
 * @module components/ui-v2/color-field
 */

export interface ColorFieldProps {
  /** Visible label. */
  label: string;
  /** Current colour as `#rrggbb`. */
  value: string;
  /** Called with a valid `#rrggbb` colour. */
  onChange: (hex: string) => void;
  /** Quick picks shown along the top of the picker (up to six). */
  swatches?: readonly string[] | undefined;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** v2 colour field. See {@link ColorFieldProps}. */
export function ColorField({ label, value, onChange, swatches }: ColorFieldProps) {
  const id = useId();
  // The text is its own state so a half-typed "#2f5" can sit there
  // without being rejected; only a complete hex is passed up.
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  // Inside a modal <dialog>, the picker portals into it (as Dropdown's list
  // does), since the dialog's top layer covers anything portalled to the body.
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  const findDialog = useCallback((el: HTMLButtonElement | null) => setDialog(el?.closest('dialog') ?? null), []);
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }
  function onText(next: string) {
    setText(next);
    if (HEX.test(next)) onChange(next.toLowerCase());
  }
  return (
    <Field id={id} label={label}>
      <div className="flex gap-2">
        {/* The app's own picker (saturation square, hue strip, hex, eyedropper),
            not the browser's, so choosing a colour looks the same everywhere. */}
        <ColorPopover
          value={value}
          swatches={swatches ?? []}
          onChange={(hex) => onChange(hex.toLowerCase())}
          container={dialog}
          trigger={
            <button
              ref={findDialog}
              type="button"
              aria-label={`${label} picker`}
              className="flex h-9 w-10 shrink-0 items-center justify-center rounded-panel border border-zebra-200 bg-field p-1 transition-colors duration-150 hover:border-zebra-300 focus-visible:border-grass-600 focus-visible:shadow-[0_0_0_3px_var(--color-grass-100)] focus-visible:outline-none"
            >
              <span style={{ '--swatch': value } as CSSProperties} className="size-full rounded-check bg-[var(--swatch)]" />
            </button>
          }
        />
        <input
          id={id}
          value={text}
          spellCheck={false}
          onChange={(e) => onText(e.target.value)}
          className={`${controlClass(!HEX.test(text))} h-9 type-code uppercase`}
        />
      </div>
    </Field>
  );
}
