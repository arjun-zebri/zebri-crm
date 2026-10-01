'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';

/**
 * The header of a send-flow editor (New contract, New invoice), laid out
 * as the proposal editor's: the title over who and what it is for, then
 * the one action (Send to Clara) and Close past a hairline, top right,
 * where every modal in the app keeps its actions. On phones the action
 * wraps under the title, full width. The send flow leaves `sub` out: a
 * second line made the bar tall, and the page below says who it is for.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/editor-header
 */

export interface EditorHeaderProps {
  title: string;
  /** Who and what it is for: "Clara & Felix · MC package · $2,400". */
  sub?: string | undefined;
  /** The primary action, usually Send. */
  action?: ReactNode;
  onClose: () => void;
}

/** The editor's header. See {@link EditorHeaderProps}. */
export function EditorHeader({ title, sub, action, onClose }: EditorHeaderProps) {
  return (
    <header className={`flex flex-wrap gap-x-6 ${sub ? 'items-start' : 'items-center'} gap-y-4 border-b border-zebra-950/5 px-5 pb-5 pt-6 md:px-8`}>
      <div className="min-w-0 flex-1 space-y-1">
        <h2 id="doc-title" className="type-title text-zebra-950">
          {title}
        </h2>
        {sub ? <p className="type-body text-zebra-500">{sub}</p> : null}
      </div>
      {action ? <div className="flex items-center gap-2 max-sm:order-last max-sm:w-full">{action}</div> : null}
      <div className="flex items-center sm:border-l sm:border-zebra-950/5 sm:pl-4">
        <Button variant="ghost" square aria-label="Close" onClick={onClose}>
          <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </Button>
      </div>
    </header>
  );
}
