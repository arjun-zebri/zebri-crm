'use client';


import { useScriptFonts } from '@/components/documents/use-script-fonts';
import { DialogHeader } from '@/components/ui-v2/dialog-parts';
import { CeremonyScriptIcon } from '@/components/ui-v2/icons';
import { InlineInput } from '@/components/ui-v2/inline-input';
import { collectScriptFonts } from '@/lib/documents/script-fonts';

import { ScriptFieldsContext } from './script-nodes';
import { ScriptPage, useScriptEditor } from './script-page';
import { printFilledScript } from './script-print';
import { ScriptSide } from './script-side';
import { patchScript } from './script-store';
import { ScriptToolbar } from './script-toolbar';
import { fieldsFor, scriptName, type Script } from './scripts-data';

/**
 * One open script at the client profile's size, laid out as the run
 * sheet is: across the top the dialog header (a quiet "Script", Close at
 * its right); on the left the script's name as the one
 * big line with the client and what is known of their event under it.
 * The name starts empty, its likely name ("Ceremony script") greyed in
 * as the placeholder, so it reads as something to type over; the toolbar, then the writing, plain white, which scrolls
 * on its own; on the right the couple's details to drop in, with
 * Download and Print at the foot. Changes save as they are made.
 *
 * @module app/design-system/v2/pages/dashboard/scripts/script-workspace
 */

export interface ScriptWorkspaceProps {
  client: string;
  script: Script;
  /** Under the name: "Sat 3 Oct · Stones of the Yarra Valley". */
  when?: string | undefined;
  onClose: () => void;
}

/** The open script. See {@link ScriptWorkspaceProps}. */
export function ScriptWorkspace({ client, script, when, onClose }: ScriptWorkspaceProps) {
  const fields = fieldsFor(client);
  const save = (patch: Partial<Script>) => patchScript(client, script.id, patch);
  const editor = useScriptEditor(script.content, (content) => save({ content }));
  // The faces the page uses, loaded from Google Fonts (CJK only when it has some).
  useScriptFonts(collectScriptFonts(script.content, script.font));
  const empty = !editor || editor.isEmpty;
  return (
    <ScriptFieldsContext.Provider value={fields}>
      <div className="flex h-full min-h-0 flex-col">
        <DialogHeader id="script-title" icon={CeremonyScriptIcon} title="Script" onClose={onClose} />
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="space-y-6 px-6 pb-4 pt-6 sm:px-10 sm:pt-10">
              <div className="space-y-1">
                <InlineInput
                  aria-label="Script name"
                  value={script.title}
                  placeholder={scriptName({ ...script, title: '' })}
                  onChange={(e) => save({ title: e.target.value })}
                  className="w-full type-title text-zebra-950 md:type-display"
                />
                <p className="type-body text-zebra-500">{when ? `${client} · ${when}` : client}</p>
              </div>
              <ScriptToolbar editor={editor} font={script.font} onFont={(font) => save({ font })} />
            </div>
            {/* Only the writing scrolls; the header, toolbar and side panel stay put. */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ScriptPage editor={editor} font={script.font} />
            </div>
          </div>
          <ScriptSide
            fields={fields}
            empty={empty}
            onInsert={(f) =>
              editor
                ?.chain()
                .focus()
                .insertContent({ type: 'variable', attrs: { id: f.id } })
                .run()
            }
            onPrint={() => printFilledScript(script, fields)}
          />
        </div>
      </div>
    </ScriptFieldsContext.Provider>
  );
}
