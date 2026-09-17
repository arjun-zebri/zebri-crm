'use client'

/**
 * The text bar (Proposal Layout v2 Phase 2, spec §4): the floating
 * bubble shown over a text selection inside a content section, driving
 * every per-run and per-block style TipTap knows about (style, font,
 * size, weight, colour, italic/underline/strike, align, lists, link,
 * insert, and text case). Every write goes through `applyTextStyle`
 * (`text-bar-style.ts`); every read comes from `readTextState` on the
 * same editor.
 *
 * `TextBarRow` is the plain 32px row: what `text-bar.test.tsx` renders
 * directly against a bare `buildRichDocExtensions({})` editor, with no
 * `BubbleMenu`/floating-ui involved. `TextBar` is what Task 12 actually
 * mounts: the same row wrapped in TipTap's `BubbleMenu`, shown only
 * over a real text selection (or while one of the row's own popovers
 * holds focus, see `bubbleShouldShow`). Both accept the same optional
 * `ref`, exposing `openLink()` for Task 15's `Meta+K` shortcut.
 *
 * Row order (controller ruling): Style, Font, Size, Weight, Colour,
 * Italic, Underline, Strike, Align, Link, Insert, then the `...`
 * overflow menu (`text-bar-overflow.tsx`) holding the list toggles and
 * the `Aa` case choices, which do not fit in the primary row alongside
 * everything else at the bar's 380px minimum width.
 *
 * `TextBarRow` reads `editor` via `useEditorState`, not a plain
 * `readTextState(editor)` call in the render body: `editor` arrives as
 * a prop (from the registry, in Task 12's mount, or straight from a
 * test), and only the component that itself calls `useEditor()`
 * auto-re-renders on every TipTap transaction. A child that merely
 * holds the same `Editor` object would otherwise show the state as of
 * whenever its *owner* last happened to re-render: one click behind a
 * fast Bold-Bold toggle.
 *
 * @module features/proposals/editor/bars/text-bar
 */
import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { Link as LinkIcon } from 'lucide-react'
import { useImperativeHandle, useState, type Ref } from 'react'

import { ToolbarDivider } from '@/components/editor'
import { Tooltip } from '@/components/ui/tooltip'

import { BarShell } from './bar-shell'
import { LinkPopover } from './link-popover'
import { TextBarAlign } from './text-bar-block'
import { TextBarInsert } from './text-bar-insert'
import { TextBarColor, TextBarInlineToggles, TextBarWeightPill } from './text-bar-marks'
import { TextBarOverflow } from './text-bar-overflow'
import { TextBarFontSelect, TextBarSizeSelect, TextBarStyleSelect } from './text-bar-selects'
import { bubbleShouldShow, readTextState, toggleButtonClass, TEXT_BAR_MENU_ATTR, TEXT_BAR_MENU_SELECTOR } from './text-bar-style'

/** Imperative handle a mounting caller can reach for without owning the row's own state. */
export interface TextBarHandle {
  /** Opens the Link popover, focused on the href field. Task 15 calls this from the `Meta+K` shortcut. */
  openLink: () => void
}

/** Props shared by {@link TextBarRow} and {@link TextBar}. */
export interface TextBarProps {
  editor: Editor
  /** Brand swatches offered by the text colour picker. Defaults to none. */
  swatches?: readonly string[] | undefined
  ref?: Ref<TextBarHandle> | undefined
}

/** The bar's plain 32px row, with no floating/positioning of its own. */
export function TextBarRow({ editor, swatches = [], ref }: TextBarProps) {
  const [linkOpen, setLinkOpen] = useState(false)
  useImperativeHandle(ref, () => ({ openLink: () => setLinkOpen(true) }), [])

  const state = useEditorState({ editor, selector: ({ editor: ed }) => readTextState(ed) })

  return (
    <div role="toolbar" aria-label="Text" {...TEXT_BAR_MENU_ATTR} className="w-full rounded-control border border-border bg-surface px-1 shadow-lg">
      <BarShell overflow={<TextBarOverflow editor={editor} state={state} />}>
        <TextBarStyleSelect editor={editor} state={state} />
        <TextBarFontSelect editor={editor} state={state} />
        <TextBarSizeSelect editor={editor} state={state} />
        <ToolbarDivider />
        <TextBarWeightPill editor={editor} state={state} />
        <TextBarColor editor={editor} state={state} swatches={swatches} />
        <TextBarInlineToggles editor={editor} state={state} />
        <ToolbarDivider />
        <TextBarAlign editor={editor} state={state} />
        <ToolbarDivider />
        <Tooltip label="Link">
          <LinkPopover
            editor={editor}
            open={linkOpen}
            onOpenChange={setLinkOpen}
            trigger={
              <button type="button" aria-label="Link" aria-pressed={Boolean(state.linkHref)} className={toggleButtonClass(Boolean(state.linkHref))}>
                <LinkIcon size={14} strokeWidth={1.5} />
              </button>
            }
          />
        </Tooltip>
        <TextBarInsert editor={editor} />
      </BarShell>
    </div>
  )
}

/**
 * The bubble: `TextBarRow`, shown over a real text selection or while one
 * of its own popovers holds focus.
 *
 * `className="z-30"` on the `BubbleMenu` (forwarded straight onto its own
 * floating element via `React.HTMLAttributes<HTMLDivElement>`, see
 * `@tiptap/react/menus`'s typings) puts it above
 * `template-editor-body.tsx`'s section/node-bar overlay strip (`z-20`):
 * without it, a selection near the top of the canvas put the bubble
 * behind that strip, hiding every control it holds. No `options.placement`
 * override is needed alongside it: `@tiptap/extension-bubble-menu`
 * defaults to `placement: 'top'` with `flip: {}` (truthy, so the flip
 * middleware is already active), which already puts the bubble below the
 * selection when there is no room above - confirmed by reading the
 * installed package's compiled defaults, not assumed.
 */
export function TextBar({ editor, swatches, ref }: TextBarProps) {
  return (
    <BubbleMenu
      editor={editor}
      className="z-30"
      shouldShow={({ editor: ed }) => {
        const { from, to, empty } = ed.state.selection
        const hasTextSelection = !empty && ed.state.doc.textBetween(from, to, '', '').length > 0
        return bubbleShouldShow({
          menuFocused: Boolean(document.activeElement?.closest(TEXT_BAR_MENU_SELECTOR)),
          hasTextSelection,
        })
      }}
    >
      <TextBarRow editor={editor} swatches={swatches} ref={ref} />
    </BubbleMenu>
  )
}
