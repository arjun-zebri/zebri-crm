import { currentSheet, saveRunSheet } from './run-sheet-store';
import { signerOf, type Moment, type RunSheet } from './run-sheets';

/**
 * What can happen to a sheet, by stage. Editing an approved or shared
 * sheet starts the next version as a draft. Sending it to the couple
 * asks for their approval; in this preview they approve it a few seconds
 * later, the way the first-run test client replies. Sharing puts it with
 * every supplier.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheet-actions
 */

/** How long the pretend couple takes to answer. */
const REPLY_MS = 4000;

/** Saves edited moments; an approved or shared sheet that changes becomes the next draft. */
export function editSheet(client: string, sheet: RunSheet, moments: Moment[]) {
  const settled = sheet.status === 'approved' || sheet.status === 'shared';
  const changed = JSON.stringify(moments) !== JSON.stringify(sheet.moments);
  const next = { ...sheet, moments, news: undefined };
  saveRunSheet(
    client,
    settled && changed ? { ...next, status: 'draft', version: sheet.version + 1 } : next,
  );
}

/** Sends the sheet to the couple; in the preview they approve it shortly. */
export function sendToCouple(client: string) {
  saveRunSheet(client, { ...currentSheet(client), status: 'with-couple', news: undefined });
  window.setTimeout(() => {
    const now = currentSheet(client);
    // Taken back to draft (edited) in the meantime: the reply waits for the next send.
    if (now.status !== 'with-couple') return;
    saveRunSheet(client, {
      ...now,
      status: 'approved',
      news: `${signerOf(now, client)} approved it.`,
    });
  }, REPLY_MS);
}

/** The couple approved it some other way (on a call). */
export const markApproved = (client: string) =>
  saveRunSheet(client, { ...currentSheet(client), status: 'approved', news: undefined });

/** Shares the approved sheet with every supplier. */
export const shareWithSuppliers = (client: string) =>
  saveRunSheet(client, {
    ...currentSheet(client),
    status: 'shared',
    news: 'Shared with your suppliers.',
  });
