'use client';

import type { Editor } from '@tiptap/react';

import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon, ListIcon, ListOrderedIcon, MinusIcon, PlusIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';
import { MenuOption } from '@/components/ui-v2/popover';
import { SCRIPT_FONT_SIZES } from '@/lib/documents/script-extensions';

import { ICON, Tool, ToolMenu } from './script-tools';

/**
 * The script toolbar's groups: the text size (A-, the size, A+), then
 * alignment (left, centre, right) and lists (bullets, numbers), each
 * collapsed to one button showing what the cursor's line has now, so the
 * whole toolbar fits on one line.
 *
 * @module app/design-system/v2/pages/dashboard/scripts/script-menus
 */

interface Choice {
  label: string;
  icon: ZebriIcon;
  on: (e: Editor) => boolean;
  pick: (e: Editor) => void;
}

const go = (e: Editor) => e.chain().focus();

const ALIGN: Choice[] = [
  {
    label: 'Left',
    icon: AlignLeftIcon,
    on: (e) => !e.isActive({ textAlign: 'center' }) && !e.isActive({ textAlign: 'right' }),
    pick: (e) => go(e).unsetTextAlign().run(),
  },
  { label: 'Centre', icon: AlignCenterIcon, on: (e) => e.isActive({ textAlign: 'center' }), pick: (e) => go(e).setTextAlign('center').run() },
  { label: 'Right', icon: AlignRightIcon, on: (e) => e.isActive({ textAlign: 'right' }), pick: (e) => go(e).setTextAlign('right').run() },
];

// Picking the list the line is already in takes it out of the list.
const LISTS: Choice[] = [
  { label: 'Bullets', icon: ListIcon, on: (e) => e.isActive('bulletList'), pick: (e) => go(e).toggleBulletList().run() },
  { label: 'Numbers', icon: ListOrderedIcon, on: (e) => e.isActive('orderedList'), pick: (e) => go(e).toggleOrderedList().run() },
];

/** One collapsed group. Its button shows the choice that is on, or the first. */
function ChoiceMenu({ name, choices, editor }: { name: string; choices: Choice[]; editor: Editor | null }) {
  const now = editor ? choices.find((c) => c.on(editor)) : undefined;
  const Icon = (now ?? choices[0]!).icon;
  return (
    <ToolMenu name={name} current={<Icon {...ICON} />}>
      {(close) =>
        choices.map(({ label, icon: Item, pick }) => (
          <MenuOption key={label} selected={now?.label === label} onSelect={() => (editor && pick(editor), close())}>
            <Item {...ICON} />
            {label}
          </MenuOption>
        ))
      }
    </ToolMenu>
  );
}

/** Left, centre or right. */
export const AlignMenu = ({ editor }: { editor: Editor | null }) => (
  <ChoiceMenu name="Alignment" choices={ALIGN} editor={editor} />
);

/** Bullets or numbers. */
export const ListMenu = ({ editor }: { editor: Editor | null }) => (
  <ChoiceMenu name="Lists" choices={LISTS} editor={editor} />
);

/** Text with no size of its own: the page's base (`.script-document .ProseMirror`). */
const BASE = 16;
const MIN = SCRIPT_FONT_SIZES[0];
const MAX = SCRIPT_FONT_SIZES[SCRIPT_FONT_SIZES.length - 1]!;

/** The size of the text at the cursor, as Word does it: A-, the size, A+, a point a step. */
export function SizeStepper({ editor }: { editor: Editor | null }) {
  const raw = editor?.getAttributes('textStyle').fontSize as string | undefined;
  const size = raw ? Number.parseInt(raw, 10) || BASE : BASE;
  // One point at a time, as Word's A- and A+ feel to use, within the ladder's ends.
  const smaller = size > MIN ? size - 1 : undefined;
  const larger = size < MAX ? size + 1 : undefined;
  const to = (n: number | undefined) => () =>
    editor && n && (n === BASE ? go(editor).unsetFontSize().run() : go(editor).setFontSize(`${n}px`).run());
  return (
    <>
      <Tool label="Smaller" onClick={to(smaller)}>
        <MinusIcon {...ICON} />
      </Tool>
      <span aria-label="Size" className="w-7 text-center type-body tabular-nums text-zebra-600">
        {size}
      </span>
      <Tool label="Larger" onClick={to(larger)}>
        <PlusIcon {...ICON} />
      </Tool>
    </>
  );
}
