'use client';

import { useState } from 'react';

import { useAccount } from '../../account';
import { addScript, useScripts } from '../../scripts/script-store';

import type { Doc } from './profile-data';
import { scriptDoc } from './script-doc';

/**
 * A client's scripts in their Documents: the rows (each opening the
 * script dialog), the one open in it, and New document > Script. A booked
 * client has a script waiting; anyone else's shows once New document
 * starts it. Without the Ceremony scripts block there are none.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/use-script-docs
 */
export function useScriptDocs(client: string, booked: boolean, pick: (id: string) => void) {
  const on = useAccount().scripts !== false;
  const scripts = useScripts(client);
  const [started, setStarted] = useState(false);
  const [writing, setWriting] = useState<string | null>(null);
  const shown = on && (booked || started) ? scripts : [];
  return {
    on,
    docs: shown.map((s) => scriptDoc(s, client)),
    /** The script open in the dialog, or null. */
    writing,
    close: () => setWriting(null),
    /** Opens a script from its row; false for any other document. */
    openDoc: (d: Doc) => {
      const script = scripts.find((s) => s.id === d.scriptId);
      return script ? (setWriting(script.id), true) : false;
    },
    /** New document > Script: the waiting one if it is not shown yet, else a new one. */
    start: () => {
      const first = scripts[0];
      const script = !shown.length && first ? first : addScript(client);
      setStarted(true);
      pick(script.id);
      setWriting(script.id);
    },
  };
}
