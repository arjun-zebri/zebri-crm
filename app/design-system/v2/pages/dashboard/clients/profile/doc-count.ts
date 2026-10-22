import { useAccount } from '../../account';
import { useBdmOn, usePaperwork } from '../../bdm/bdm-store';
import { useSent } from '../../questionnaires/questionnaire-store';
import { useScripts } from '../../scripts/script-store';

import { paperworkDoc } from './paperwork-doc';
import type { Doc } from './profile-data';
import { questionnaireDoc } from './questionnaire-doc';
import { scriptDoc } from './script-doc';

/**
 * How many documents a client has, for the number beside Documents in
 * the profile's rail. Counted from the same sources the Documents
 * section lists (the profile's own, plus paperwork, questionnaires and
 * scripts from their stores), so the rail and the list never disagree
 * (user, 2026-10-15: the rail said 1 beside a list of 2).
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/doc-count
 */

/** How many real documents there are: a run sheet or script still to start is a to-do, not one. */
export const countDocs = (docs: Doc[]) => docs.filter((d) => d.state !== 'To start').length;

/** The client's document count; `docs` is the profile's own, run sheet already drawn from its sheet. */
export function useDocCount(docs: Doc[], client: string): number {
  const account = useAccount();
  const bdm = useBdmOn();
  const paper = usePaperwork(client);
  const sent = useSent().filter((s) => s.client === client);
  const scripts = useScripts(client);
  return countDocs([
    ...(bdm && paper ? [paperworkDoc(paper)] : []),
    ...sent.map(questionnaireDoc),
    ...(account.scripts !== false ? scripts.map((s) => scriptDoc(s, client)) : []),
    ...docs.filter((d) => account.runSheets !== false || !d.runSheet),
  ]);
}
