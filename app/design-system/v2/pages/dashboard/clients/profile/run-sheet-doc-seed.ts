import type { Doc } from './profile-data';

/**
 * Every booked client's run sheet, as a Documents row. A placeholder:
 * its status, wording and facts come from the sheet itself (`withSheet`
 * in `run-sheet-doc.tsx`). Its own module because both `profile-data.ts`
 * and `amelia-jack.ts` list it, and those two import each other.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/run-sheet-doc-seed
 */
export const RUN_SHEET_DOC: Doc = {
  id: 'run-sheet',
  type: 'RUN',
  title: 'Run sheet',
  sub: '',
  status: 'draft',
  state: 'Draft',
  date: '',
  group: 'progress',
  facts: [],
  runSheet: true,
};
