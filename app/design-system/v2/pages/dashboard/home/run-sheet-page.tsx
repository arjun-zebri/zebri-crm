'use client';

import { Designed } from '../canvas/docs/designed';

import type { Moment } from './run-sheets';

/**
 * A run sheet as the couple and the suppliers get it: the MC's run sheet
 * design (their letterhead, the couple's names in the heading face, then
 * the night moment by moment, each start time in the brand colour, with
 * who runs it and the cue), filled with this night. The timeline is
 * locked in the design: suppliers work from it. It is the copy Download
 * gives and Send shares, so the night's paperwork looks as finished as
 * the proposal that won the booking.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheet-page
 */

export interface RunSheetPageProps {
  /** The couple, as written on the sheet. */
  client: string;
  /** Their event's date and venue, under the names. */
  when?: string | undefined;
  moments: Moment[];
}

/** The shared copy. See {@link RunSheetPageProps}. */
export function RunSheetPage({ client, when, moments }: RunSheetPageProps) {
  return <Designed kind="run-sheet" data={{ couple: client, when, moments }} label={`Run sheet for ${client}`} />;
}
