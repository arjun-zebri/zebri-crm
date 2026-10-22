'use client';

import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from 'react';

import { ImageUpIcon } from '@/components/ui-v2/icons';

import { TooltipLabel } from './tooltip';

/**
 * Design system v2 file drop (preview): a dashed box that takes a file
 * by drag and drop or by click, and previews an image once chosen.
 *
 * The native file input stays in the box (visually hidden), so the box
 * is a real, focusable control that keyboard and screen reader users
 * can open like any file picker. The box around it takes the focus mark
 * (`focus-mark-within`) while the input has keyboard focus; a file
 * dragged over it tints it grass.
 *
 * `inline` is the compact form for a picker that sits among other
 * controls (the brand's logo in a Style popover): no dashed box, just the
 * image (or a placeholder) in a small tile beside its label, the whole
 * row the target, with drag and drop still working. `value` shows an
 * image already chosen (a saved logo) until a new one is picked.
 *
 * `face` is the tile form, for a picker that is its own picture (the
 * brand kit's logo on light and on dark): only what `face` draws, as the
 * target, with no words beside it; `label` is read out instead. The
 * caller draws the chosen image itself, from `value`. It is named by a
 * Tooltip on hover or focus, never a native `title`.
 *
 * @example
 * ```tsx
 * <FileDrop label="Logo" accept="image/png,image/svg+xml" help="PNG or SVG." />
 * ```
 *
 * @module components/ui-v2/file-drop
 */

export interface FileDropProps {
  /** Visible label above the box. */
  label: string;
  /** Helper text below the box. */
  help?: string | undefined;
  /** The input's `accept` list. */
  accept?: string | undefined;
  /** Called with the chosen file. */
  onFile?: ((file: File) => void) | undefined;
  /** The compact row form, with no box. */
  inline?: boolean | undefined;
  /** An image already chosen (a URL), shown until a new pick. */
  value?: string | null | undefined;
  /** The tile form: this is the whole target, with `label` read out only. */
  face?: ReactNode;
  /** Greys it out; no file can be chosen or dropped. */
  disabled?: boolean | undefined;
}

/** The disabled look, keyed off the hidden input, since the box is a `<label>`. */
const OFF = 'has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50';

/** v2 file drop. See {@link FileDropProps}. */
export function FileDrop({ label, help, accept, onFile, inline = false, value, face, disabled = false }: FileDropProps) {
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  // Object URLs hold the file in memory until revoked: release the old
  // one on every new pick, and the last one when the box unmounts.
  const urlRef = useRef<string | null>(null);
  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  function take(f: File | undefined) {
    if (!f) return;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = f.type.startsWith('image/') ? URL.createObjectURL(f) : null;
    setPreview(urlRef.current);
    setFile(f);
    onFile?.(f);
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    if (disabled) return;
    take(e.dataTransfer.files[0]);
  }

  const shown = preview ?? value ?? null;
  const input = (
    <input
      id={id}
      type="file"
      accept={accept}
      disabled={disabled}
      aria-describedby={help ? `${id}-help` : undefined}
      onChange={(e) => take(e.target.files?.[0])}
      className="sr-only"
    />
  );
  if (face !== undefined)
    return (
      <label
        htmlFor={id}
        aria-label={label}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`group/tip-in relative block cursor-pointer rounded-button transition-shadow duration-150 focus-mark-within ${OFF} motion-reduce:transition-none ${over ? 'ring-2 ring-selected' : ''}`}
      >
        {input}
        {face}
        <TooltipLabel label={label} />
      </label>
    );
  if (inline)
    return (
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`-mx-2 flex cursor-pointer items-center gap-3 rounded-button px-2 py-1.5 transition-colors duration-150 focus-mark-within ${OFF} motion-reduce:transition-none ${over ? 'bg-grass-50' : 'hover:bg-hover'}`}
      >
        {input}
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-button bg-zebra-100 text-zebra-500 ring-1 ring-hairline">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="size-full object-contain p-1" />
          ) : (
            <ImageUpIcon aria-hidden="true" className="size-4" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block type-label text-zebra-950">{label}</span>
          <span id={help ? `${id}-help` : undefined} className="block truncate type-body text-zebra-500">
            {file ? file.name : (help ?? 'Drop a file, or click to choose')}
          </span>
        </span>
        <span className="type-body text-zebra-950 underline underline-offset-2">{shown ? 'Replace' : 'Upload'}</span>
      </label>
    );
  return (
    <div className="space-y-2">
      {/* Help under the label, as in every v2 field (see Field). */}
      <div className="space-y-0.5">
        <label htmlFor={id} className="block type-label text-zebra-950">
          {label}
        </label>
        {help ? (
          <p id={`${id}-help`} className="type-body text-zebra-500">
            {help}
          </p>
        ) : null}
      </div>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`flex min-h-24 cursor-pointer items-center gap-4 rounded-panel border border-dashed px-4 py-3 transition-colors duration-150 focus-mark-within ${OFF} motion-reduce:transition-none ${
          over ? 'border-selected bg-grass-50' : 'border-zebra-300 bg-field hover:border-zebra-400'
        }`}
      >
        {input}
        {preview ? (
          // Object URLs cannot go through next/image; a plain img is right here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-16 shrink-0 rounded-button object-contain" />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-button bg-zebra-100 text-zebra-500">
            <ImageUpIcon aria-hidden="true" className="size-5" />
          </span>
        )}
        <span className="min-w-0 type-body text-zebra-600">
          {file ? (
            <span className="block truncate text-zebra-950">{file.name}</span>
          ) : (
            <>
              Drop a file here, or <span className="text-zebra-950 underline underline-offset-2">browse</span>
            </>
          )}
        </span>
      </label>
    </div>
  );
}
