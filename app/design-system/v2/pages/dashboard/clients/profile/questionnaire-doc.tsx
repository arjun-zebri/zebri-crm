'use client';

import { asked, progressOf, titleOf, type Sent } from '../../questionnaires/questionnaire-data';

import type { Doc } from './profile-data';

/**
 * A questionnaire sent to the client, as one of their documents, drawn
 * from the sent copy so the row and the questionnaire agree. Waiting
 * on answers is in progress (amber, with how far they are); completed
 * is complete. Its row opens it, with Remind beside while it waits
 * (`use-questionnaire-docs`).
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/questionnaire-doc
 */

/** The questionnaire's Documents row. */
export function questionnaireDoc(s: Sent): Doc {
  const done = s.status === 'completed';
  const n = asked(s.copy).length;
  return {
    id: s.id,
    type: 'FORM',
    title: titleOf(s.copy),
    // The state says where it stands; the line under the name says how big it is, or how far.
    sub: s.status === 'started' ? progressOf(s) : `${n} ${n === 1 ? 'question' : 'questions'}`,
    status: done ? 'done' : 'waiting',
    state: done ? 'Completed' : s.status === 'started' ? 'Answering' : 'Not started',
    date: done ? (s.completedOn ?? s.sentOn) : s.sentOn,
    group: done ? 'complete' : 'progress',
    facts: [],
    questionnaireId: s.id,
  };
}
