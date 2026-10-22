'use client';

import type { Paperwork } from '../../bdm/bdm-data';
import { lineOf, nextOf, sectionOf, stateOf } from '../../bdm/status';

import type { Doc, DocStatus } from './profile-data';

/**
 * A client's marriage paperwork as a document (the Lodge with BDM
 * block), drawn from the paperwork itself, so the row, the paperwork
 * dialog and the Documents page always agree. The row says where it
 * stands in a line and opens the paperwork (`use-paperwork-docs`).
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/paperwork-doc
 */

export const PAPERWORK_DOC_ID = 'bdm-paperwork';

/** Amber while it is with someone or needs the celebrant, green once lodged or on its way, grey before it goes out. */
function statusOf(p: Paperwork): DocStatus {
  const section = sectionOf(p);
  if (section === 'draft') return 'draft';
  if (section === 'done') return 'done';
  if (p.stage === 'lodged' || nextOf(p) === 'wait') return 'scheduled';
  return 'waiting';
}

/** The paperwork's Documents row. */
export function paperworkDoc(p: Paperwork): Doc {
  return {
    id: PAPERWORK_DOC_ID,
    type: 'BDM',
    title: 'Marriage paperwork',
    sub: lineOf(p),
    status: statusOf(p),
    state: stateOf(p),
    date: p.lodgedOn ?? p.sentOn ?? '',
    group: p.stage === 'registered' ? 'complete' : 'progress',
    facts: [],
    paperwork: true,
  };
}
