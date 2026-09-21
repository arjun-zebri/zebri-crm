'use client'

/**
 * The text bar (Proposal Layout v2 Phase 2, spec §4): the floating
 * bubble shown over a text selection inside a content section, driving
 * every per-run and per-block style TipTap knows about (style, font,
 * size, bold, colour, italic/underline/strike, align, lists, link, and
 * text case). Inserting content is the `/` menu's job, not this bar's. Every write goes through `applyTextStyle`
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
 * Row order (controller ruling, colour and bold swapped by the founder):
 * Style, Font, Size, Colour, Bold, Italic, Underline, Strike, Align,
 * Link, then the `...`
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
import { useEffect, useImperativeHandle, useState, type Ref } from 'react'

import { ToolbarDivider } from '@/components/editor'
import { Tooltip } from '@/components/ui/tooltip'

import type { ProposalTheme } from '../../model/theme'

import { BarShell } from './bar-shell'
import { LinkPopover } from './link-popover'
import { TextBarAlign } from './text-bar-block'
import { TextBarBoldToggle, TextBarColor, TextBarInlineToggles } from './text-bar-marks'
import { TextBarOverflow } from './text-bar-overflow'
import { TextBarFontSelect, TextBarSizeStepper, TextBarStyleSelect } from './text-bar-selects'
import { bubbleShouldShow, readTextState, toggleButtonClass, TEXT_BAR_MENU_ATTR, TEXT_BAR_MENU_SELECTOR } from './text-bar-style'

const TEXT_BAR_HOST_ID = 'proposal-text-bar-host'

/**
 * The one body-level element every `TextBar` bubble is appended to (see
 * `TextBar`'s doc for why it must live outside the section). It is a
 * dedicated host rather than `document.body` itself because
 * `BubbleMenuView.blurHandler` keeps the bubble open whenever
 * `element.parentNode.contains(event.relatedTarget)` - with body as the
 * parent that is every element on the page, so clicking from one
 * `InlineField` into another (or onto a focusable section) never hid the
 * bar (2026-09-19 testimonials feedback). With this host as the parent,
 * only focus landing on a text bar itself keeps one open, exactly the
 * semantics the default in-section mount had.
 */
function textBarHost(): HTMLElement {
  let host = document.getElementById(TEXT_BAR_HOST_ID)
  if (!host) {
    host = document.createElement('div')
    host.id = TEXT_BAR_HOST_ID
    document.body.appendChild(host)
  }
  return host
}

/** The bubble's own `PluginKey` name, so {@link useHideOnOutsidePointerDown} can address it with the plugin's documented `setMeta(pluginKey, 'hide')`. */
const TEXT_BAR_PLUGIN_KEY = 'textBar'

/**
 * Hides the bubble on any pointerdown outside both the editor and the
 * bar's own popovers. `BubbleMenuView` only hides itself on an editor
 * `blur`, and once a bar control has taken focus (Bold, a select, the
 * link field) the editor is already blurred - so the next click anywhere
 * else never blurred it again and the bar stayed put over a field nobody
 * was editing (2026-09-19 testimonials feedback). Bar-owned popovers are
 * recognised by `TEXT_BAR_MENU_ATTR`; only an editor with a real
 * selection can be showing a bar, so the rest dispatch nothing.
 */
function useHideOnOutsidePointerDown(editor: Editor): void {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node) || editor.state.selection.empty) return
      if (editor.view.dom.contains(target)) return
      if (target instanceof Element && target.closest(TEXT_BAR_MENU_SELECTOR)) return
      editor.view.dispatch(editor.state.tr.setMeta(TEXT_BAR_PLUGIN_KEY, 'hide'))
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [editor])
}

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
  /** The canvas theme (Global style), which seeds each field's default from the selection's active role - Size, Colour, Weight, Line height, Letter spacing - until an explicit override is set, and keeps those defaults live as Global style is edited. */
  theme: ProposalTheme
  ref?: Ref<TextBarHandle> | undefined
}

/** The bar's plain 32px row, with no floating/positioning of its own. */
export function TextBarRow({ editor, swatches = [], theme, ref }: TextBarProps) {
  const [linkOpen, setLinkOpen] = useState(false)
  useImperativeHandle(ref, () => ({ openLink: () => setLinkOpen(true) }), [])

  const state = useEditorState({ editor, selector: ({ editor: ed }) => readTextState(ed) })

  return (
    <div role="toolbar" aria-label="Text" {...TEXT_BAR_MENU_ATTR} className="w-max max-w-full rounded-control border border-border bg-surface p-1 shadow-lg">
      <BarShell overflow={<TextBarOverflow editor={editor} state={state} theme={theme} />}>
        <TextBarStyleSelect editor={editor} state={state} />
        <TextBarFontSelect editor={editor} state={state} theme={theme} />
        <TextBarSizeStepper editor={editor} state={state} theme={theme} />
        <ToolbarDivider />
        <TextBarColor editor={editor} state={state} swatches={swatches} theme={theme} />
        <TextBarBoldToggle editor={editor} state={state} />
        <TextBarInlineToggles editor={editor} state={state} />
        <ToolbarDivider />
        <TextBarAlign editor={editor} state={state} />
        <ToolbarDivider />
        <Tooltip side="top" label="Link">
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
 * behind that strip, hiding every control it holds. `options.placement` is
 * `bottom` (see the JSX comment); `@tiptap/extension-bubble-menu` keeps
 * `flip: {}` on by default, so the bubble still goes above the selection
 * when there is no room below.
 *
 * `appendTo: document.body` + `strategy: 'fixed'` (2026-09-19 bug: making a
 * content section's height very small made the bubble disappear on
 * selecting text) - `@tiptap/extension-bubble-menu` defaults to appending
 * its floating element inside the editor's own DOM parent, which for a
 * content section is `ContentSectionFrame`'s `overflow-hidden` `<section>`
 * (needed so a short, height-constrained section actually clips its own
 * content). Once the section got short enough, the bubble's computed
 * position - correctly placed relative to the selection - fell outside
 * that box's clipped bounds and Floating UI's `overflow: hidden` ancestor
 * clipped it away entirely. Appending to `document.body` with a `fixed`
 * strategy (position relative to the viewport, matching the viewport-
 * relative rect `posToDOMRect` already reports) escapes every section's
 * own clipping, exactly like a Radix popover portalling to body. The
 * target is `textBarHost()` rather than body itself - see its doc.
 */
export function TextBar({ editor, swatches, theme, ref }: TextBarProps) {
  useHideOnOutsidePointerDown(editor)
  return (
    <BubbleMenu
      editor={editor}
      pluginKey={TEXT_BAR_PLUGIN_KEY}
      className="z-30"
      appendTo={textBarHost}
      // Below the selection, 8px off it: above (the default) hid the line
      // you were formatting against, most often a heading directly over
      // the paragraph being styled (audit pass 2). `flip` still moves it
      // above when there is no room below. Without an explicit offset
      // Floating UI's default is 0 and the bar sat flush on the text.
      // `strategy: 'fixed'` pairs with `appendTo` above.
      options={{ offset: 8, placement: 'bottom', strategy: 'fixed' }}
      shouldShow={({ editor: ed }) => {
        const { from, to, empty } = ed.state.selection
        const hasTextSelection = !empty && ed.state.doc.textBetween(from, to, '', '').length > 0
        return bubbleShouldShow({
          menuFocused: Boolean(document.activeElement?.closest(TEXT_BAR_MENU_SELECTOR)),
          hasTextSelection,
        })
      }}
    >
      <TextBarRow editor={editor} swatches={swatches} theme={theme} ref={ref} />
    </BubbleMenu>
  )
}
