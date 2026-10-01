'use client';

import { ImageUp } from 'lucide-react';
import { useEffect, useId, useRef, useState, type DragEvent } from 'react';

/**
 * Design system v2 file drop (preview): a dashed box that takes a file
 * by drag and drop or by click, and previews an image once chosen.
 *
 * The native file input stays in the box (visually hidden), so the box
 * is a real, focusable control that keyboard and screen reader users
 * can open like any file picker.
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
}

/** v2 file drop. See {@link FileDropProps}. */
export function FileDrop({ label, help, accept, onFile }: FileDropProps) {
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
    take(e.dataTransfer.files[0]);
  }

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
        className={`flex min-h-24 cursor-pointer items-center gap-4 rounded-panel border border-dashed px-4 py-3 transition-colors duration-150 has-[:focus-visible]:border-grass-600 has-[:focus-visible]:shadow-[0_0_0_3px_var(--color-grass-100)] ${
          over ? 'border-grass-600 bg-grass-50' : 'border-zebra-300 bg-field hover:border-zebra-400'
        }`}
      >
        <input
          id={id}
          type="file"
          accept={accept}
          aria-describedby={help ? `${id}-help` : undefined}
          onChange={(e) => take(e.target.files?.[0])}
          className="sr-only"
        />
        {preview ? (
          // Object URLs cannot go through next/image; a plain img is right here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-16 shrink-0 rounded-button object-contain" />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-button bg-zebra-100 text-zebra-500">
            <ImageUp aria-hidden="true" strokeWidth={1.5} className="size-5" />
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
