'use client'

/**
 * The text bar's inline mark controls: Weight (Regular/Bold, via the
 * `bold` mark), the text colour picker, and Italic/Underline/Strike.
 * Split into three exports (rather than one) so `text-bar.tsx` can
 * place Colour between Weight and the I/U/S cluster, per the row order
 * the controller ruled on.
 *
 * @module features/proposals/editor/bars/text-bar-marks
 */
import type { Editor } from '@tiptap/react'
import { Italic, Strikethrough, Underline } from 'lucide-react'

import { PillToggle } from '@/components/editor'
import { ColorPopover } from '@/components/ui/color-popover'
import { Tooltip } from '@/components/ui/tooltip'

import { applyTextStyle, TEXT_BAR_MENU_ATTR, type TextState } from './text-bar-style'
import { TextBarToggleButton } from './text-bar-toggle-button'

/** Weight pill: Regular / Bold, via the `bold` mark. */
export function TextBarWeightPill({ editor, state }: { editor: Editor; state: TextState }) {
  return (
    <PillToggle<'regular' | 'bold'>
      value={state.bold ? 'bold' : 'regular'}
      onChange={(v) => applyTextStyle(editor, { bold: v === 'bold' })}
      options={[
        { value: 'regular', label: 'Regular' },
        { value: 'bold', label: 'Bold' },
      ]}
    />
  )
}

/** Italic, Underline and Strike toggles. */
export function TextBarInlineToggles({ editor, state }: { editor: Editor; state: TextState }) {
  return (
    <>
      <TextBarToggleButton label="Italic" active={state.italic} onClick={() => applyTextStyle(editor, { italic: !state.italic })}>
        <Italic size={14} strokeWidth={1.5} />
      </TextBarToggleButton>
      <TextBarToggleButton label="Underline" active={state.underline} onClick={() => applyTextStyle(editor, { underline: !state.underline })}>
        <Underline size={14} strokeWidth={1.5} />
      </TextBarToggleButton>
      <TextBarToggleButton label="Strikethrough" active={state.strike} onClick={() => applyTextStyle(editor, { strike: !state.strike })}>
        <Strikethrough size={14} strokeWidth={1.5} />
      </TextBarToggleButton>
    </>
  )
}

/** Default text colour offered when the selection has none of its own. */
const DEFAULT_COLOR = '#111827'

/** Props for {@link TextBarColor}. */
export interface TextBarColorProps {
  editor: Editor
  state: TextState
  swatches: readonly string[]
}

/** The Text colour `ColorPopover`. Focus is deliberately not forced on pick (mirrors the Branding bubble's `CaretSafeColor`): forcing it while dragging the picker would fight the picker's own inputs. */
export function TextBarColor({ editor, state, swatches }: TextBarColorProps) {
  const value = state.color ?? DEFAULT_COLOR
  return (
    <Tooltip label="Text colour">
      <ColorPopover
        value={value}
        onChange={(c) => editor.chain().setColor(c).run()}
        swatches={swatches}
        contentProps={TEXT_BAR_MENU_ATTR}
        trigger={
          <button type="button" aria-label="Text colour" className="inline-flex h-8 items-center gap-1 rounded-control px-1.5 text-text-muted hover:bg-surface-emphasis hover:text-text">
            <span className="text-body font-semibold leading-none">A</span>
            <span className="h-1.5 w-3.5 rounded-control" style={{ backgroundColor: value }} />
          </button>
        }
      />
    </Tooltip>
  )
}
