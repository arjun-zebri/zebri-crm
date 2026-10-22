'use client';

import { Button } from '@/components/ui-v2/button';

import { markApproved } from '../../home/run-sheet-actions';
import { signerOf, type RunSheet } from '../../home/run-sheets';

import type { Doc } from './profile-data';

/**
 * The client's run sheet as a document: its row's wording is drawn from the sheet itself, so a change made from Home shows here
 * and the reverse. The row opens the run sheet dialog; while it is with
 * the couple, They approved it sits on the row, for an approval that
 * happened on a call.
 *
 * An empty sheet reads as a to-do: Run sheet, To start (the badge says
 * it is not started; a title saying Start too said it twice).
 *
 * Run sheets have no page of their own: this is where they live. The
 * first time the MC is brought here (Show me, after adding the block),
 * Zebri says one line above it; nothing else teaches it.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/run-sheet-doc
 */

/** The run sheet's Documents row, filled in from the sheet. */
export function withSheet(d: Doc, sheet: RunSheet, client: string): Doc {
  const who = signerOf(sheet, client);
  const { status, version } = sheet;
  // Nothing in it yet: a to-do rather than a document, so the row asks
  // to be started instead of reading as an empty draft.
  if (!sheet.moments.length && status === 'draft')
    return { ...d, title: 'Run sheet', sub: '', state: 'To start', facts: [] };
  return {
    ...d,
    sub: `${sheet.moments.length} moments · v${version}`,
    status: status === 'draft' ? 'draft' : status === 'with-couple' ? 'waiting' : 'done',
    state:
      status === 'draft'
        ? 'Draft'
        : status === 'with-couple'
          ? `With ${who}`
          : status === 'approved'
            ? 'Approved'
            : 'Shared',
    group: status === 'shared' ? 'complete' : 'progress',
    facts: [
      {
        label: 'Couple',
        value:
          status === 'draft'
            ? 'Not sent yet'
            : status === 'with-couple'
              ? `With ${who} to approve`
              : 'Approved',
      },
      {
        label: 'Suppliers',
        value: status === 'shared' ? `Have v${version}` : 'Get it once it is shared',
      },
    ],
  };
}

/** Zebri's line on arrival, true to where the sheet stands. */
export function introFor(sheet: RunSheet, client: string): string {
  const who = signerOf(sheet, client);
  return sheet.status === 'draft'
    ? `${client}'s run sheet lives here. Lay out their night, then send it to ${who} to approve.`
    : sheet.status === 'with-couple'
      ? `${client}'s run sheet lives here, with ${who} to approve.`
      : `${client}'s run sheet lives here, approved. Change anything and it goes back to them as the next version.`;
}

/** They approved it, on the row while the sheet is with the couple; null otherwise. */
export function runSheetAction(sheet: RunSheet, client: string) {
  return sheet.status === 'with-couple' ? (
    <Button variant="text" onClick={() => markApproved(client)}>
      They approved it
    </Button>
  ) : null;
}
