'use client';

import { IconCircle } from '@/components/ui-v2/icon-circle';
import { RunSheetIcon } from '@/components/ui-v2/icons';

import { useAccount } from '../account';
import { UpNextRow } from '../up-next-row';

import { useRunSheet } from './run-sheet-store';

/**
 * Up next's one push for run sheets: an MC builds a sheet a few weeks
 * out, not the day they add the block, so this is where they are shown
 * it. While the next event is four weeks away or less and its sheet has
 * not gone to the couple, a to-do row asks for it (Start, or Finish once
 * it has moments). Sending it takes the row away. Nothing shows without
 * the Run sheets block.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheet-nudge
 */

/** How close the event is, in days, before the sheet is asked for. */
const NUDGE_DAYS = 28;

export interface RunSheetNudgeProps {
  client: string;
  /** Whole days until the event. */
  days: number;
  onOpen: () => void;
}

/** The to-do row, or nothing. See {@link RunSheetNudgeProps}. */
export function RunSheetNudge({ client, days, onOpen }: RunSheetNudgeProps) {
  const on = useAccount().runSheets !== false;
  const sheet = useRunSheet(client);
  if (!on || sheet.status !== 'draft' || days > NUDGE_DAYS) return null;
  const started = sheet.moments.length > 0;
  return (
    <li>
      <UpNextRow
        lead={<IconCircle icon={RunSheetIcon} />}
        title={`${client}'s run sheet`}
        detail={started ? 'is not sent yet.' : 'is not started yet.'}
        action={{ label: started ? 'Open' : 'Start', primary: !started, onClick: onOpen }}
      />
    </li>
  );
}
