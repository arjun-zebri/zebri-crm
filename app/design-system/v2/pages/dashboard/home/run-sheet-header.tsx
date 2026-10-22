'use client';


import { Badge, type BadgeTone } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { DIALOG_HEADER_PAD } from '@/components/ui-v2/dialog-parts';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { CloseIcon, RunSheetIcon, SparklesIcon } from '@/components/ui-v2/icons';

import type { Insight } from './run-sheet-insights';
import { signerOf, type Moment, type RunSheet, type SheetStatus } from './run-sheets';

/**
 * The top of an open run sheet, as New client's is: a quiet "Run sheet",
 * the couple's names as the one big line, and under them the event and
 * where the sheet stands as a badge (Draft, With Jack, Approved,
 * Shared). Under that, in the faintest grey, anything Zebri noticed
 * about the night (`insightsFor`), each with its one-click fix when
 * there is one. The top row is {@link RunSheetBar}, `DialogHeader`'s
 * anatomy and padding (icon circle, quiet title, ghost Close) drawn here
 * because Close moves by width: it sits on the bar below lg, where the
 * side panel stacks under the day, and on the side panel's top at lg.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheet-header
 */

export interface RunSheetHeaderProps {
  client: string;
  sheet: RunSheet;
  /** Under the names: "Sat 3 Oct · Stones of the Yarra Valley". */
  when?: string | undefined;
  insights: Insight[];
  /** Applies an insight's fix to the moments. */
  onApply: (apply: (moments: Moment[]) => Moment[]) => void;
}

// Amber while it waits on someone else; green once it is settled.
const TONE: Record<SheetStatus, BadgeTone> = {
  draft: 'neutral',
  'with-couple': 'warning',
  approved: 'brand',
  shared: 'brand',
};

/** The header. See {@link RunSheetHeaderProps}. */
export function RunSheetHeader({
  client,
  sheet,
  when,
  insights,
  onApply,
}: RunSheetHeaderProps) {
  const badge = {
    draft: 'Draft',
    'with-couple': `With ${signerOf(sheet, client)}`,
    approved: 'Approved',
    shared: 'Shared',
  }[sheet.status];
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <p className="type-title text-zebra-950 md:type-display">{client}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 type-body text-zebra-500">
          {when ? <span>{when}</span> : null}
          <Badge tone={TONE[sheet.status]}>{badge}</Badge>
        </div>
        {insights.length ? (
          <ul aria-label="Zebri noticed" className="pt-1">
            {insights.map(({ id, text, action }) => (
              <li key={id} className="flex flex-wrap items-center gap-x-2 type-body text-zebra-400">
                <SparklesIcon aria-hidden="true" className="size-3.5 shrink-0" />
                <span>{text}</span>
                {action ? (
                  <Button
                    variant="plain"
                    onClick={() => onApply(action.apply)}
                    className="underline underline-offset-2"
                  >
                    {action.label}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The run sheet's top row: "Run sheet" in its circle, and Close below
 * lg (at lg it is on the side panel's top). `inset` (default) gives it
 * every dialog's header padding (Settings', 2026-10-15); off, it sits in
 * its parent's padding (the Blocks image's scaled-down scene).
 */
export function RunSheetBar({ onClose, inset = true }: { onClose: () => void; inset?: boolean }) {
  return (
    <div className={`flex shrink-0 items-center justify-between gap-2 ${inset ? DIALOG_HEADER_PAD : '-my-2'}`}>
      <div className="flex items-center gap-2">
        <IconCircle icon={RunSheetIcon} />
        <h2 id="run-sheet-title" className="type-label text-zebra-500">
          Run sheet
        </h2>
      </div>
      <Button variant="ghost" square aria-label="Close" onClick={onClose} className={inset ? 'lg:hidden' : '-mr-2 lg:hidden'}>
        <CloseIcon aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
}
