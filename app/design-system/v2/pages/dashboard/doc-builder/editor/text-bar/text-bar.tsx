'use client';

import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { createContext, use, useImperativeHandle, useState } from 'react';

import { FLOATING_BAR } from '@/components/ui-v2/control-styles';
import { BoldIcon, DragIcon, ItalicIcon, ListIcon, ListOrderedIcon, StrikethroughIcon, UnderlineIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';
import { Tooltip } from '@/components/ui-v2/tooltip';
import { applyTextStyle, readTextState, type TextBarProps, type TextState, type TextStylePatch } from '@/features/proposals';
import type { PublicBranding } from '@/lib/branding/public-branding';

import { BarButton, BarRule } from '../section-bar/bar-parts';

import { AlignMenu } from './align-menu';
import { CaseMenu } from './case-menu';
import { ColourMenu } from './colour-menu';
import { FontMenu } from './font-menu';
import { LinkMenu } from './link-menu';
import { SizeField } from './size-field';
import { useDragBar, type ScreenPoint } from './use-drag-bar';

/**
 * The bar over selected words, in the section bar's white (founder,
 * 2026-10-10): Font and size | colour (an A over a bar of it), Bold,
 * Italic, Underline, Strikethrough, case | the two lists, align | link.
 * Everything is on the bar; there is no ⋯. Drawn inside production's
 * bubble (`TextBar`'s `row`), which keeps placing and hiding it, and
 * takes production's row props (the `ref` serves Cmd+K's `openLink()`);
 * the brand's named colours and where it was dragged to come in through
 * {@link TextBarHostProvider}. Its grip moves it (`use-drag-bar.ts`).
 * Every part carries `data-text-bar` so the bubble stays while one of
 * its menus is in use.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/text-bar/text-bar
 */

/** What the editor around the bar hands it: the brand its colour list names, and where the MC left the bar. */
export interface TextBarHost {
  branding: PublicBranding;
  /** Where the bar was dragged to; null while it sits under the words. */
  pinned: ScreenPoint | null;
  onPin: (at: ScreenPoint) => void;
}

const Host = createContext<TextBarHost | null>(null);

/** Hands the bar its {@link TextBarHost}. */
export const TextBarHostProvider = Host.Provider;

/** The on/off marks and lists, each a toggle on the bar. */
const TOGGLES: { key: keyof TextState & keyof TextStylePatch; label: string; icon: ZebriIcon }[][] = [
  [
    { key: 'bold', label: 'Bold', icon: BoldIcon },
    { key: 'italic', label: 'Italic', icon: ItalicIcon },
    { key: 'underline', label: 'Underline', icon: UnderlineIcon },
    { key: 'strike', label: 'Strikethrough', icon: StrikethroughIcon },
  ],
  [
    { key: 'bulletList', label: 'Bulleted list', icon: ListIcon },
    { key: 'orderedList', label: 'Numbered list', icon: ListOrderedIcon },
  ],
];

/** One group of toggles. */
function Toggles({ editor, state, group }: { editor: Editor; state: TextState; group: (typeof TOGGLES)[number] }) {
  return group.map(({ key, label, icon: Icon }) => (
    <BarButton key={key} label={label} on={Boolean(state[key])} onClick={() => applyTextStyle(editor, { [key]: !state[key] })}>
      <Icon aria-hidden="true" className="size-4" />
    </BarButton>
  ));
}

/** The row, as production's bubble draws it. */
export function DocTextBar({ editor, theme, ref }: TextBarProps) {
  const { branding, pinned, onPin } = use(Host)!;
  const { row, grab } = useDragBar(editor, pinned, onPin);
  const [linkOpen, setLinkOpen] = useState(false);
  useImperativeHandle(ref, () => ({ openLink: () => setLinkOpen(true) }), []);
  // Read through the editor's own subscription, so the bar is never a click behind the words.
  const state = useEditorState({ editor, selector: ({ editor: ed }) => readTextState(ed) });
  const parts = { editor, state };
  return (
    <div ref={row} role="toolbar" aria-label="Text" data-text-bar="" className={`w-max ${FLOATING_BAR}`}>
      <Tooltip side="top" label="Drag to move">
        <span onPointerDown={grab} className="flex h-9 w-5 cursor-grab touch-none items-center justify-center text-zebra-400 transition-colors duration-150 hover:text-zebra-950 active:cursor-grabbing motion-reduce:transition-none">
          <DragIcon aria-hidden="true" className="size-4" />
        </span>
      </Tooltip>
      <FontMenu {...parts} theme={theme} />
      <SizeField {...parts} theme={theme} />
      <BarRule />
      <ColourMenu {...parts} branding={branding} theme={theme} />
      <Toggles {...parts} group={TOGGLES[0]!} />
      <CaseMenu {...parts} />
      <BarRule />
      <Toggles {...parts} group={TOGGLES[1]!} />
      <AlignMenu {...parts} />
      <BarRule />
      <LinkMenu {...parts} open={linkOpen} onOpenChange={setLinkOpen} />
    </div>
  );
}
