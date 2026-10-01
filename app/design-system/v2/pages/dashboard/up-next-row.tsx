import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';

/**
 * One row of the Up next panel: a button that opens what the row is
 * about in a dialog (a drafted reply, the run sheet). Nothing opens in
 * place, so the panel never changes height under the pointer.
 *
 * A to-do row (`action`) is the MC's own job rather than something to
 * look at: the row itself does nothing, and its one button does the job.
 * Buttons appear only on the MC's to-dos, never on what the client did.
 *
 * @module app/design-system/v2/pages/dashboard/up-next-row
 */

export interface UpNextRowProps {
  /** Avatar or icon at the start. */
  lead: ReactNode;
  title: string;
  detail: string;
  /** Right-hand badge or time. */
  trail?: ReactNode;
  /** Opens what the row is about. Left out on a to-do row, whose button does the job. */
  onOpen?: (() => void) | undefined;
  /** Makes it a to-do: the button's label and what it does. `primary` for the one move that matters now. */
  action?: { label: string; onClick: () => void; primary?: boolean | undefined } | undefined;
}

/** An Up next row. See {@link UpNextRowProps}. */
export function UpNextRow({ lead, title, detail, trail, onOpen, action }: UpNextRowProps) {
  if (action)
    return (
      // On phones the button drops under the words at full width, so the
      // words keep the whole row instead of a column a few words wide.
      <div className="flex w-full flex-wrap items-center gap-3 px-3 py-2.5">
        {lead}
        {/* Wraps rather than truncates: a to-do's words are the instruction. */}
        <span className="min-w-0 flex-1 text-pretty type-body">
          <span className="type-label text-zebra-950">{title}</span>
          {/* Keyed, so new words (a reply landing) fade in rather than snap. */}
          <span key={detail} className="text-zebra-500 motion-safe:animate-[fade-in_300ms_ease-out_both]"> {detail}</span>
        </span>
        {trail ? <span className="shrink-0">{trail}</span> : null}
        <Button variant={action.primary ? 'primary' : 'secondary'} onClick={action.onClick} className="shrink-0 max-sm:w-full">
          {action.label}
        </Button>
      </div>
    );
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-button px-3 py-2.5 text-left transition-colors duration-150 hover:bg-zebra-950/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 motion-reduce:transition-none"
    >
      {lead}
      <span className="min-w-0 flex-1 truncate type-body">
        <span className="type-label text-zebra-950">{title}</span>
        <span key={detail} className="text-zebra-500 motion-safe:animate-[fade-in_300ms_ease-out_both]"> {detail}</span>
      </span>
      <span className="shrink-0">{trail}</span>
      <ChevronRight
        aria-hidden="true"
        strokeWidth={1.5}
        className="size-4 shrink-0 text-zebra-400"
      />
    </button>
  );
}
