'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button, type ButtonVariant } from './button';

/**
 * Copy-to-clipboard button that does not change size when it fires.
 *
 * The idle and confirmed labels are stacked in one grid cell, so the
 * button is always as wide as the longer of the two and swapping between
 * them shifts nothing on the row. Hand-rolled copy buttons did
 * `{copied ? 'Copied!' : 'Copy link'}`, which grew or shrank the control
 * mid-click and nudged everything beside it.
 *
 * Owns the clipboard write and the revert timer so call sites do not each
 * re-implement them (and so the timer is always cleared on unmount).
 *
 * @example
 * ```tsx
 * <CopyButton value={shareUrl} label="Copy link" />
 * <CopyButton value={embedCode} label="Copy" variant="outline" />
 * ```
 *
 * @module components/ui/copy-button
 */

export interface CopyButtonProps {
  /** Text written to the clipboard. Pass a function to defer anything
   *  that touches `window` (e.g. building a URL from `location.origin`),
   *  which is not available when this renders on the server. */
  value: string | (() => string);
  /** Idle label. Defaults to `'Copy'`. */
  label?: string;
  /** Confirmed label. Defaults to `'Copied'`. */
  copiedLabel?: string;
  /** Button variant, passed straight through. Defaults to `'outline'`. */
  variant?: ButtonVariant;
  /** How long the confirmed state shows, in ms. Defaults to 2000. */
  revertAfterMs?: number;
  /** Extra classes on the button. */
  className?: string;
  /** Accessible name. Defaults to the idle `label`. */
  'aria-label'?: string;
  /** Fired after a successful write. */
  onCopied?: () => void;
  /** Disables the button. */
  disabled?: boolean;
  /**
   * Render as bare text rather than a bordered control.
   *
   * For meta rows that read as a sentence ("Share link live · Copy link ·
   * Open"), where a 32px button would break the line. Same size-stable
   * label swap either way.
   */
  plain?: boolean;
}

/** Copy button with a size-stable confirmed state. See {@link CopyButtonProps}. */
export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  variant = 'outline',
  revertAfterMs = 2000,
  className,
  onCopied,
  disabled,
  plain = false,
  ...rest
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear on unmount: a copy followed by closing the modal would
  // otherwise setState on an unmounted component.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(typeof value === 'function' ? value() : value);
    } catch {
      // Clipboard is unavailable outside a secure context or when the
      // user denied permission. Nothing useful to say, and throwing here
      // would take the surrounding page down with it.
      return;
    }
    setCopied(true);
    onCopied?.();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), revertAfterMs);
  };

  const iconSize = plain ? 12 : 14;

  /* Both labels occupy the same grid cell, so the cell is as wide as the
     longer one and neither state resizes the control. */
  const labels = (
    <span className="grid">
      <span
        aria-hidden={copied}
        className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 whitespace-nowrap${
          copied ? ' invisible' : ''
        }`}
      >
        <Copy width={iconSize} height={iconSize} strokeWidth={1.5} aria-hidden="true" />
        {label}
      </span>
      <span
        aria-hidden={!copied}
        className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 whitespace-nowrap${
          copied ? '' : ' invisible'
        }`}
      >
        <Check
          width={iconSize}
          height={iconSize}
          strokeWidth={1.5}
          aria-hidden="true"
          className={plain ? 'text-success' : undefined}
        />
        {copiedLabel}
      </span>
    </span>
  );

  if (plain) {
    return (
      <button
        type="button"
        onClick={copy}
        disabled={disabled}
        aria-label={rest['aria-label'] ?? label}
        aria-live="polite"
        className={`inline-flex items-center text-body text-text-muted transition-colors hover:text-text disabled:opacity-50${
          className ? ` ${className}` : ''
        }`}
      >
        {labels}
      </button>
    );
  }

  return (
    <Button
      variant={variant}
      onClick={copy}
      aria-label={rest['aria-label'] ?? label}
      aria-live="polite"
      {...(disabled !== undefined && { disabled })}
      {...(className !== undefined && { className })}
    >
      {labels}
    </Button>
  );
}
