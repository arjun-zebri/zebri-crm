'use client';

import type { Editor } from '@tiptap/react';

import { BoldIcon, ItalicIcon, UnderlineIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';
import type { ScriptFontId } from '@/lib/documents/script-fonts';

import { AlignMenu, ListMenu, SizeStepper } from './script-menus';
import { FontMenu, ICON, Tool } from './script-tools';

/**
 * One quiet row above the page, kept to one line, in the order a writer
 * reaches for it: the script's face and the text's size (A-, the size,
 * A+); bold, italic and underline; alignment
 * and lists, each collapsed to one menu. No page tools: the print
 * window lays the pages out. Undo and redo are the keyboard's (Cmd+Z), not
 * buttons: the row had no room for them. Groups are split by gaps, not
 * rules.
 *
 * @module app/design-system/v2/pages/dashboard/scripts/script-toolbar
 */

interface Spec {
  label: string;
  icon: ZebriIcon;
  on?: (e: Editor) => boolean;
  run: (e: Editor) => void;
}

const go = (e: Editor) => e.chain().focus();
/** The marks, after the size. */
const MARKS: Spec[] = [
  { label: 'Bold', icon: BoldIcon, on: (e) => e.isActive('bold'), run: (e) => go(e).toggleBold().run() },
  { label: 'Italic', icon: ItalicIcon, on: (e) => e.isActive('italic'), run: (e) => go(e).toggleItalic().run() },
  { label: 'Underline', icon: UnderlineIcon, on: (e) => e.isActive('underline'), run: (e) => go(e).toggleUnderline().run() },
];

const Gap = () => <span aria-hidden="true" className="w-2" />;

export interface ScriptToolbarProps {
  editor: Editor | null;
  font: ScriptFontId;
  onFont: (font: ScriptFontId) => void;
}

/** The toolbar. See {@link ScriptToolbarProps}. */
export function ScriptToolbar({ editor, font, onFont }: ScriptToolbarProps) {
  const run = (fn: (e: Editor) => void) => () => editor && fn(editor);
  return (
    // Pulled left by a button's side padding, so "Noto Serif" lines up with the name above.
    <div role="toolbar" aria-label="Formatting" className="-ml-2 flex flex-wrap items-center gap-0.5 lg:flex-nowrap [&>*]:shrink-0">
      <FontMenu font={font} onFont={(id) => (onFont(id), editor?.commands.focus())} />
      <SizeStepper editor={editor} />
      <Gap />
      {MARKS.map(({ label, icon: Icon, on, run: fn }) => (
        <Tool key={label} label={label} on={editor && on ? on(editor) : false} onClick={run(fn)}>
          <Icon {...ICON} />
        </Tool>
      ))}
      <Gap />
      <AlignMenu editor={editor} />
      <ListMenu editor={editor} />
    </div>
  );
}
