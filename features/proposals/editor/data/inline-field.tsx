'use client'

/**
 * One inline TipTap field for a data section's own text - FAQ question/
 * answer, testimonial quote/names/detail, the accept heading/reassurance,
 * the packages heading (UX audit 3.4, Slice E1: "everything in every
 * block can be clicked and edited"). Styled with `EDITOR_FIELD_PROSE_CLASS`,
 * a content section's prose rules minus paragraph spacing (see
 * `editor-styles.ts`), so a data section's text looks identical
 * typed-into or read on the public page;
 * the caller supplies the surrounding wrapper (the `<h2>`, the card, ...)
 * that already carries the real typographic style, so this component
 * only ever needs to inherit it, not reproduce it.
 *
 * History is off - `HistoryKeymapExtension` forwards Cmd/Ctrl+Z and
 * Cmd/Ctrl+Shift+Z to the layout editor's own undo stack (`../state.ts`),
 * reached here through `field-shortcuts.tsx`'s context rather than the
 * per-section editor registry a content section uses - so this field
 * never grows a second, competing undo history.
 *
 * A caller that passes `richTextBar` gets the same `TextBar` bubble menu
 * a content section's selection shows (2026-09-18: packages text wants
 * the same formatting functionality as the text section). It mounts
 * straight on this field's own local `editor` instead of going through
 * `editor-registry.ts`: that registry assumes one editor per section,
 * which a packages section (many fields, one section id) cannot satisfy -
 * `TextBar` only ever needs the `Editor` instance to bind its `BubbleMenu`
 * to, so a field-local mount works exactly the same way. Not registered
 * in `editor-registry.ts` itself for that reason: a caller that does not
 * pass `richTextBar` gets no toolbar, exactly as before.
 *
 * @module features/proposals/editor/data/inline-field
 */
import type { JSONContent } from '@tiptap/core'
import { Placeholder } from '@tiptap/extension-placeholder'
import { EditorContent, ReactNodeViewRenderer, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useMemo } from 'react'

import { FluidFontSizeExtension } from '@/lib/branding/fluid-font-size'
import { RICH_TEXT_EXTENSIONS, Variable as VariableBase } from '@/lib/branding/rich-text-extensions'
import { toPlainJSON } from '@/lib/utils'

import type { RichDoc } from '../../model/layout'
import type { ProposalTheme } from '../../model/theme'
import { TextBar } from '../bars/text-bar'
import { EDITOR_FIELD_PROSE_CLASS } from '../editor-styles'
import { HistoryKeymapExtension } from '../extensions/history-keymap'
import { ProposalEditorStorageExtension } from '../extensions/proposal-editor-storage'
import { TextAlignExtension } from '../extensions/text-align'
import {
  InlineFieldSlashVariableExtension, VARIABLE_AT_PLUGIN_KEY, VARIABLE_BRACES_PLUGIN_KEY, VARIABLE_SLASH_PLUGIN_KEY, VariableSuggestionExtension,
} from '../extensions/variable-suggestion'
import { VariableView } from '../node-views/variable-view'
import { useRehydrateEditor } from '../use-rehydrate-editor'

import { useFieldShortcuts } from './field-shortcuts'

/**
 * `RICH_TEXT_EXTENSIONS` minus its bare, un-configured `StarterKit`, its
 * plain `variable` node and its stock `textAlign` extension - all three
 * get a replacement below (a `StarterKit.configure({ undoRedo: false })`,
 * a `Variable` extended with the proposal canvas's own chip node view,
 * and the canvas's own `TextAlignExtension`), so building the base set
 * once at module scope (rather than per render, or worse per keystroke)
 * is safe: nothing here is caller-specific.
 *
 * The stock text-align extension is swapped out for the same reason a
 * content section's editor swapped it (`extensions/text-align.ts`'s
 * module doc): it stores a pasted `text-align: left` as a real `'left'`,
 * and inline beats everything above it - so a heading whose field had
 * once taken a paste ignored the section's own Alignment for good (live
 * bug, 2026-09-19). The canvas's extension drops that on parse, so a
 * stored `'left'` is only ever the Align pill's own pick and renders.
 *
 * The stock `fontSize` goes too, for `FluidFontSizeExtension`: the public
 * page renders a size past 32px as a container `clamp()`
 * (`lib/branding/render-rich-text.ts`), so the mobile canvas has to shrink
 * it the same way or the author sees a title the couple's phone will not.
 */
const BASE_EXTENSIONS = RICH_TEXT_EXTENSIONS.filter((e) => e.name !== 'starterKit' && e.name !== 'variable' && e.name !== 'textAlign' && e.name !== 'fontSize')

/** The shared `Variable` node, given the same chip node view the proposal canvas's rich-text sections already render (`node-views/variable-view.tsx`) - one look for "this fills in later" everywhere in the proposal editor, data sections included. */
const FieldVariable = VariableBase.extend({
  addNodeView() {
    return ReactNodeViewRenderer(VariableView)
  },
})

/** An empty single-paragraph doc: the fallback for an empty/falsy value. */
const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

/**
 * Always-on additions to `EDITOR_PROSE_CLASS` for a data-section field,
 * appended after any caller `className` so they win the cascade:
 *
 * - Placeholder colour pinned to `text-text-subtle` (design rule 5,
 *   deliverable notes) rather than `EDITOR_PROSE_CLASS`'s own rule, which
 *   ties placeholder opacity to the *section's* text colour - right for a
 *   full content section that can sit on a dark photo background, wrong
 *   here: every data section renders on a plain surface, so a fixed
 *   token reads correctly regardless of branding.
 */
const FIELD_CLASS_ADDITIONS =
  '[&_.is-empty::before]:!text-text-subtle [&_.is-empty::before]:!opacity-100'

/**
 * Coerce a data section field's `RichTextValue` (TipTap JSON, or a legacy
 * plain string) to a TipTap doc. Mirrors the Branding editor's own
 * `toDoc` (`rich-text.tsx`) - duplicated rather than imported, since this
 * feature may not import that editor's components (see this module's own
 * layering note in the feature's CLAUDE.md).
 */
function toDoc(value: RichDoc | string): JSONContent {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return { type: 'doc', content: [{ type: 'paragraph', ...(trimmed ? { content: [{ type: 'text', text: value }] } : {}) }] }
  }
  return value && Object.keys(value).length > 0 ? value : EMPTY_DOC
}

/** Props for {@link InlineField}. */
export interface InlineFieldProps {
  /** Current field value: TipTap JSON, or a legacy plain string. */
  value: RichDoc | string
  /** Fired with normalised JSON (already `toPlainJSON`ed) on every edit. */
  onChange: (json: JSONContent) => void
  placeholder?: string
  /** Enter commits and blurs instead of starting a new paragraph; Shift+Enter still inserts a hard break in every mode. */
  singleLine?: boolean
  /**
   * Appended to the ProseMirror element's own class (not a wrapper), so a
   * caller can override `EDITOR_PROSE_CLASS`'s default paragraph spacing
   * to match the exact public wrapper the field sits inside - e.g. the
   * FAQ answer's `[&_p]:m-0 [&_p]:mb-2 [&_p:last-child]:mb-0`
   * (`lib/branding/public-blocks/proposal/faq.tsx`'s own `Rich` call).
   */
  className?: string
  /** `LayoutEditorState.externalVersion` - re-hydrates the live editor only on a real external change (undo/redo), never a live edit. See `use-rehydrate-editor.ts`. */
  externalVersion: number
  /** Fired when the field gains focus, so the caller can select the owning section - the same path `ContentSectionEditor`'s `onFocusSection` drives, needed here because a click landing inside this field's own `.ProseMirror` element is excluded from `editable-section.tsx`'s click-anywhere-selects handler (`CLICK_THROUGH_SELECTOR`). */
  onFocus?: () => void
  /**
   * Fired once with the live `Editor` instance after it mounts. Not part
   * of `editor-registry.ts` (see the module doc): this is the seam a
   * later slice's text bar, or a test that needs to drive the editor
   * imperatively (`ed.commands...`, `fireEvent.keyDown(ed.view.dom, ...)`
   * - the same pattern `content-section-editor.test.tsx` uses via the
   * registry), can use without this component taking on registry
   * semantics it does not need yet.
   */
  onReady?: (editor: Editor) => void
  /** Mounts a `TextBar` bubble menu on this field's own editor (see the module doc). Omitted, the field has no toolbar - exactly the pre-2026-09-18 behaviour. */
  richTextBar?: { theme: ProposalTheme; swatches?: readonly string[] } | undefined
}

/** One inline TipTap field for a data section's text. See the module doc for the full rationale. */
export function InlineField({ value, onChange, placeholder, singleLine = false, className = '', externalVersion, onFocus, onReady, richTextBar }: InlineFieldProps) {
  const extensions = useMemo(
    () => [
      ...BASE_EXTENSIONS,
      FluidFontSizeExtension,
      StarterKit.configure({ undoRedo: false }),
      FieldVariable,
      TextAlignExtension.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      // The keymap forwards to callbacks held in this storage; see the
      // effect below for how they get there.
      ProposalEditorStorageExtension,
      HistoryKeymapExtension,
      // `@` / `{{` / `/` all open the variable list here: these fields
      // have no text bar or block-insertion `/` menu (see
      // `variable-suggestion.ts`'s module doc for why `/` is a second,
      // field-only extension rather than a third plugin on the first).
      VariableSuggestionExtension,
      InlineFieldSlashVariableExtension,
    ],
    [placeholder],
  )

  const editor = useEditor({
    extensions,
    content: toDoc(value),
    // Matches every other proposal-editor field (`ContentSectionEditor`):
    // TipTap's SSR HTML would not match the client's first paint of a doc
    // built from JSON (attrs order, whitespace).
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `${EDITOR_FIELD_PROSE_CLASS} ${FIELD_CLASS_ADDITIONS}${className ? ` ${className}` : ''}`,
        role: 'textbox',
        'aria-multiline': singleLine ? 'false' : 'true',
        ...(placeholder ? { 'aria-label': placeholder } : {}),
      },
      handleKeyDown: (view, event) => {
        if (!singleLine || event.key !== 'Enter' || event.shiftKey) return false
        // View props run before plugin props, so while the `@` / `{{` / `/`
        // list is open Enter must fall through to it (pick the highlighted
        // variable) instead of blurring the field (live check).
        const suggesting = [VARIABLE_AT_PLUGIN_KEY, VARIABLE_BRACES_PLUGIN_KEY, VARIABLE_SLASH_PLUGIN_KEY].some((k) => k.getState(view.state)?.active)
        if (suggesting) return false
        event.preventDefault()
        view.dom.blur()
        return true
      },
    },
    onUpdate: ({ editor: ed }) => onChange(toPlainJSON(ed.getJSON())),
    onFocus: () => onFocus?.(),
  })

  useEffect(() => {
    if (editor) onReady?.(editor)
    // `onReady` is a one-shot mount hook, not a reactive dependency: most
    // callers pass a fresh closure every render, and re-running this
    // effect on that alone would call it repeatedly for the same editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  // Undo/redo from the layout editor (`field-shortcuts.tsx`), and an
  // `escape` that exists only so the keymap reports Escape handled and
  // blurs the field (the section stays selected; nothing else to step out
  // of from inside a card). Re-set whenever the provider's callbacks change.
  const shortcuts = useFieldShortcuts()
  useEffect(() => {
    if (!editor || !shortcuts) return
    editor.commands.setProposalEditorCallbacks({ undo: shortcuts.undo, redo: shortcuts.redo, escape: () => {} })
  }, [editor, shortcuts])

  useRehydrateEditor(editor, toDoc(value), externalVersion)

  if (!editor) return null
  // No hover/focus ring here (2026-09-18 feedback: a data field reads and
  // edits exactly like a content section's text - no boxed-in-a-box
  // chrome). Selection affordance stays where `ContentSectionEditor` puts
  // it too: the section-level ring in `editable-section.tsx`.
  return (
    <>
      <EditorContent editor={editor} />
      {richTextBar ? <TextBar editor={editor} theme={richTextBar.theme} swatches={richTextBar.swatches ?? []} /> : null}
    </>
  )
}
