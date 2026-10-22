'use client';

import { TextSelection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { FLOATING_BAR } from '@/components/ui-v2/control-styles';
import { BoldIcon, Heading2Icon, ItalicIcon, LinkIcon, StrikethroughIcon, UnderlineIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';
import { InlineInput } from '@/components/ui-v2/inline-input';

/**
 * The bar over selected text in a journey email, as production's
 * proposal editor shows one: heading, bold, italic, underline, strike
 * and link, each lit while on. Link turns the bar into one line to type
 * the address on (Enter sets it, an empty one takes the link off). It
 * shows only over a real text selection, never over a picked block,
 * which has its own controls.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/email-editor/email-bubble
 */

const MARKS: { label: string; icon: ZebriIcon; on: (e: Editor) => boolean; run: (e: Editor) => void }[] = [
  { label: 'Heading', icon: Heading2Icon, on: (e) => e.isActive('heading'), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'Bold', icon: BoldIcon, on: (e) => e.isActive('bold'), run: (e) => e.chain().focus().toggleBold().run() },
  { label: 'Italic', icon: ItalicIcon, on: (e) => e.isActive('italic'), run: (e) => e.chain().focus().toggleItalic().run() },
  { label: 'Underline', icon: UnderlineIcon, on: (e) => e.isActive('underline'), run: (e) => e.chain().focus().toggleUnderline().run() },
  { label: 'Strikethrough', icon: StrikethroughIcon, on: (e) => e.isActive('strike'), run: (e) => e.chain().focus().toggleStrike().run() },
];

/**
 * Only over a real text selection. Module-level, like `appendTo` below
 * held in a callback: a new function on every render re-registered the
 * bubble's plugin, whose transaction re-rendered the editor, which made a
 * new function again (a "Maximum update depth" loop, 2026-10-08).
 */
const showOver: NonNullable<Parameters<typeof BubbleMenu>[0]['shouldShow']> = ({ editor: e, from, to }) => from !== to && e.state.selection instanceof TextSelection;

/** The bar. */
export function EmailBubble({ editor }: { editor: Editor | null }) {
  const [linking, setLinking] = useState(false);
  const [href, setHref] = useState('');
  const host = useCallback(() => editor?.view.dom.closest('dialog') ?? document.body, [editor]);
  if (!editor) return null;
  const setLink = () => {
    const chain = editor.chain().focus().extendMarkRange('link');
    (href.trim() ? chain.setLink({ href: href.trim() }) : chain.unsetLink()).run();
    setLinking(false);
  };
  return (
    <BubbleMenu
      editor={editor}
      appendTo={host}
      shouldShow={showOver}
      className={`${FLOATING_BAR} z-[95] text-zebra-700`}
    >
      {linking ? (
        <form onSubmit={(e) => (e.preventDefault(), setLink())} className="flex items-center gap-1">
          <InlineInput autoFocus aria-label="Link" placeholder="https://" value={href} onChange={(e) => setHref(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setLinking(false)} className="w-56 px-2 type-body" />
          <Button type="submit" variant="ghost" compact>
            {href.trim() ? 'Add' : 'Remove'}
          </Button>
        </form>
      ) : (
        <>
          {MARKS.map(({ label, icon: Icon, on, run }) => (
            <Button key={label} variant="ghost" square tooltipSide="top" aria-label={label} aria-pressed={on(editor)} active={on(editor)} onClick={() => run(editor)}>
              <Icon aria-hidden="true" className="size-4" />
            </Button>
          ))}
          <Button variant="ghost" square tooltipSide="top" aria-label="Link" aria-pressed={editor.isActive('link')} active={editor.isActive('link')} onClick={() => (setHref(String(editor.getAttributes('link').href ?? '')), setLinking(true))}>
            <LinkIcon aria-hidden="true" className="size-4" />
          </Button>
        </>
      )}
    </BubbleMenu>
  );
}
