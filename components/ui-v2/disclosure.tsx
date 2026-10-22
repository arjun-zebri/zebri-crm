'use client';

import { useId, useState, type ReactNode } from 'react';

import { Collapse } from './collapse';
import { MinusIcon, PlusIcon } from './icons';

/**
 * Design system v2 disclosure (preview): a question that opens to its
 * answer, for an FAQ or any "more about this" list. The whole question
 * line is the button, and it wraps onto as many lines as it needs (a
 * `Button` is a fixed 36px, which clips a long question on a phone). The
 * question and answer are 13px regular (a list of ten 16px questions
 * read too large; founder, 2026-10-18), with a plus that becomes a minus as the answer
 * eases open through `Collapse`. Stack them with a hairline between, in
 * a list.
 *
 * @example
 * ```tsx
 * <ul className="divide-y divide-hairline">
 *   <li><Disclosure title="Is there a free plan?">No, but every plan starts with a 7-day trial.</Disclosure></li>
 * </ul>
 * ```
 *
 * @module components/ui-v2/disclosure
 */

export interface DisclosureProps {
  /** The question, always shown. */
  title: string;
  /** The answer, shown once opened. */
  children: ReactNode;
  /** Start open. */
  defaultOpen?: boolean | undefined;
}

/** v2 disclosure. See {@link DisclosureProps}. */
export function Disclosure({ title, children, defaultOpen = false }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="group flex w-full items-start justify-between gap-6 rounded-check py-4 text-left type-body text-zebra-950 focus-mark"
      >
        <span className="group-hover:text-zebra-600">{title}</span>
        {open ? (
          <MinusIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-zebra-500" />
        ) : (
          <PlusIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-zebra-500" />
        )}
      </button>
      <Collapse open={open}>
        <div id={panelId} className="max-w-2xl pb-5 type-body text-zebra-500">
          {children}
        </div>
      </Collapse>
    </div>
  );
}
