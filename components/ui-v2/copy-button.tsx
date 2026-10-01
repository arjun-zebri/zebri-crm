'use client';

import { Check, Link2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from './button';

/**
 * Design system v2 copy button (preview): copies `value` and says
 * "Copied" for a moment, without changing size. Both labels sit in one
 * grid cell and the hidden one keeps its width, so a row of these never
 * shifts when one fires. A secondary {@link Button} underneath.
 *
 * @example
 * ```tsx
 * <CopyButton value="https://zebri.com/amelia/intro" />
 * <CopyButton value={portalUrl} label="Portal link" variant="ghost" />
 * ```
 *
 * @module components/ui-v2/copy-button
 */

export interface CopyButtonProps {
  value: string;
  /** Resting label. Defaults to "Copy link". */
  label?: string | undefined;
  /**
   * `'secondary'` (default) in a list of settings; `'ghost'` in a header
   * row where a bordered button would outweigh the page's main action.
   */
  variant?: 'secondary' | 'ghost' | undefined;
}

// Long enough to be read, short enough that a second copy is not blocked.
const COPIED_MS = 1600;

/** v2 copy button. See {@link CopyButtonProps}. */
export function CopyButton({ value, label = 'Copy link', variant = 'secondary' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(id);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard can be refused (insecure context, permissions); the
      // button simply does not confirm, which is the honest outcome.
    }
  };
  const Icon = copied ? Check : Link2;
  return (
    <Button variant={variant} onClick={copy} aria-live="polite">
      <Icon aria-hidden="true" strokeWidth={1.5} className="size-4" />
      <span className="grid">
        <span className={`col-start-1 row-start-1 ${copied ? 'invisible' : ''}`}>{label}</span>
        <span className={`col-start-1 row-start-1 ${copied ? '' : 'invisible'}`}>Copied</span>
      </span>
    </Button>
  );
}
