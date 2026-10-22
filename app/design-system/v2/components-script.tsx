'use client';

import { useScripts } from './pages/dashboard/scripts/script-store';
import { ScriptWorkspace } from './pages/dashboard/scripts/script-workspace';
import { Group, Spec } from './showroom-v2';

/**
 * v2 script: the open script as its dialog shows it, rendered from its
 * real source on a demo client's first script (shared with their
 * Documents, so words written here show there).
 *
 * @module app/design-system/v2/components-script
 */
export function ComponentsScriptV2() {
  const script = useScripts('Amelia & Jack')[0];
  return (
    <Group id="script" title="Script">
      <Spec
        name="Script"
        file="app/design-system/v2/pages/dashboard/scripts/script-workspace.tsx"
        description="A script is a page the MC writes freely, in any language, laid out as the run sheet is. The name is the one big line: empty at first, its likely name greyed in as the placeholder, so it reads as editable. Under it the client, and the date and venue only once known. One quiet row of tools on one line, split by gaps, not rules: the face (a compact menu, each listed in itself); A-, size, A+; bold, italic, underline; alignment and lists, each one menu showing the current icon. Undo and redo are Cmd+Z only. The writing is plain white, in line with the name and toolbar (the toolbar pulled left by a button's padding so the font name lines up), set in the script's face; no paper or page tools, the print window lays out pages. A rule separates the details panel. On the right, what Zebri knows about the client, under quiet headings by source (Client, Event, Their answers, People on the day), never a fixed wedding list: their answers are the MC's own questionnaire questions. Only answered details show; the rest sit behind one line ('2 not answered yet'). Each row tints and shows a + on hover; click to drop it where you are writing. Once in, a detail is plain text, as it prints, with no ring when selected; one still to come is its label in amber on the page and 'To come' in grey on the right. One Print or save PDF button, off until there are words."
      >
        <div className="h-[40rem] overflow-hidden rounded-panel bg-field ring-1 ring-zebra-950/5">
          {script ? (
            <ScriptWorkspace
              client="Amelia & Jack"
              script={script}
              when="Sat 10 Oct · Hawthorn Hall"
              onClose={() => undefined}
            />
          ) : null}
        </div>
      </Spec>
    </Group>
  );
}
