'use client';

import { scriptPlainText } from '@/lib/documents/script-extensions';

import { filledIn } from '../../scripts/script-print';
import { fieldsFor, scriptName, type Script } from '../../scripts/scripts-data';

import type { Doc } from './profile-data';

/**
 * A client's script as a document, drawn from the script itself so the
 * row and the page agree. One not written yet is a to-do (Start script,
 * To start), as an empty run sheet is; once it has words, its row says
 * how long it is, and the row opens the script dialog. Scripts are the MC's own working copy, so they never go to
 * anyone: no sent or signed state, only the words.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/script-doc
 */

/** The script's Documents row. */
export function scriptDoc(script: Script, client: string): Doc {
  const words = wordsOf(script, client);
  const started = words.length > 0;
  const name = scriptName(script);
  return {
    id: script.id,
    type: 'SCR',
    // Not "Start …": the To start badge says that.
    title: name,
    sub: started ? `${words.split(/\s+/).length} words` : 'Not started',
    status: 'draft',
    state: started ? 'Draft' : 'To start',
    date: '',
    group: 'progress',
    facts: [],
    scriptId: script.id,
  };
}

/** The script's words with its fields filled in. */
function wordsOf(script: Script, client: string): string {
  return script.content ? scriptPlainText(filledIn(script.content, fieldsFor(client))) : '';
}
