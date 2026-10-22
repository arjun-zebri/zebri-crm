import type { JSONContent } from '@tiptap/core';

import { printScript } from '@/components/print/print-script';

import type { Script, ScriptField } from './scripts-data';

/**
 * Printing a script: every field in it becomes the couple's words first
 * (or its label, while the answer is still to come), so the page that
 * prints is plain text in the script's face, then it goes through the
 * current app's bare print (no header, footer or frame). Download takes
 * the same path: the print window saves it as a PDF.
 *
 * @module app/design-system/v2/pages/dashboard/scripts/script-print
 */

/** The page with each field swapped for its words. */
export function filledIn(content: JSONContent, fields: ScriptField[]): JSONContent {
  if (content.type === 'variable') {
    const f = fields.find((x) => x.id === content.attrs?.id);
    return { type: 'text', text: f?.value ?? f?.label ?? '' };
  }
  return content.content
    ? { ...content, content: content.content.map((c) => filledIn(c, fields)) }
    : content;
}

/** Prints the script with its fields filled in. */
export function printFilledScript(script: Script, fields: ScriptField[]) {
  if (!script.content) return;
  printScript({
    title: script.title,
    content: filledIn(script.content, fields),
    font: script.font,
  });
}
