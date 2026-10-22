'use client';

import type { JSONContent } from '@tiptap/core';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, ReactNodeViewRenderer, useEditor, type Editor } from '@tiptap/react';

import { Variable } from '@/lib/branding/rich-text-extensions';
import { EMPTY_SCRIPT_DOC, SCRIPT_EXTENSIONS } from '@/lib/documents/script-extensions';
import { scriptFontStack, type ScriptFontId } from '@/lib/documents/script-fonts';

import { FieldChip } from './script-nodes';

/**
 * The script's writing surface: plain white, in line with the name and
 * the toolbar above it, set in the script's face. No paper, no pages:
 * the print window lays the pages out. `useScriptEditor` makes the
 * editor (the current app's script schema, with fields added back: here
 * a script does fill in the client's details); `ScriptPage` draws it.
 *
 * @module app/design-system/v2/pages/dashboard/scripts/script-page
 */

const EXTENSIONS = [
  ...SCRIPT_EXTENSIONS,
  Variable.extend({ addNodeView: () => ReactNodeViewRenderer(FieldChip) }),
  Placeholder.configure({
    placeholder: 'Start writing. Add their names and details from the right.',
  }),
];

/**
 * The editor for one script, seeded once from `content`. Every edit hands
 * up plain JSON (a server action drops TipTap's null-prototype attrs).
 */
export function useScriptEditor(
  content: JSONContent | null,
  onChange: (content: JSONContent) => void,
): Editor | null {
  return useEditor({
    extensions: EXTENSIONS,
    content: content ?? EMPTY_SCRIPT_DOC,
    immediatelyRender: false,
    // The toolbar shows what is on at the cursor, so it redraws as the cursor moves.
    shouldRerenderOnTransaction: true,
    // The header's side padding, so the first letter sits under the name's.
    editorProps: { attributes: { class: 'min-h-full px-6 pb-10 pt-4 outline-none sm:px-10' } },
    onUpdate: ({ editor }) => onChange(JSON.parse(JSON.stringify(editor.getJSON())) as JSONContent),
  });
}

export interface ScriptPageProps {
  editor: Editor | null;
  font: ScriptFontId;
}

/** The writing surface. See {@link ScriptPageProps}. */
export function ScriptPage({ editor, font }: ScriptPageProps) {
  return (
    <div
      className="script-document h-full text-zebra-950"
      // The script's own face: a value from the MC's choice, which no class holds.
      style={{ fontFamily: scriptFontStack(font) }}
      onClick={(e) => e.target === e.currentTarget && editor?.commands.focus('end')}
    >
      <EditorContent
        editor={editor}
        className="h-full [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-zebra-400 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]"
      />
    </div>
  );
}
