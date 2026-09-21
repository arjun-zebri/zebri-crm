'use client'

/**
 * The text bar's inline mark controls: Bold (via the `bold` mark), the
 * text colour picker, and Italic/Underline/Strike. Split into three
 * exports (rather than one) so `text-bar.tsx` can order Colour, then
 * Bold, then the I/U/S cluster. Bold is a plain icon toggle like its
 * I/U/S neighbours, not the
 * Regular/Bold pill it started as: the founder found the pill odd next
 * to three icon toggles doing the same job.
 *
 * @module features/proposals/editor/bars/text-bar-marks
 */
import type { Editor } from '@tiptap/react'
import { Bold, Italic, Strikethrough, Underline } from 'lucide-react'

import { ColorPopover } from '@/components/ui/color-popover'
import { Tooltip } from '@/components/ui/tooltip'

import type { ProposalTheme } from '../../model/theme'

import { applyTextStyle, TEXT_BAR_MENU_ATTR, type TextState } from './text-bar-style'
import { TextBarToggleButton } from './text-bar-toggle-button'

/** Bold toggle, via the `bold` mark. */
export function TextBarBoldToggle({ editor, state }: { editor: Editor; state: TextState }) {
  return (
    <TextBarToggleButton label="Bold" active={state.bold} onClick={() => applyTextStyle(editor, { bold: !state.bold })}>
      <Bold size={14} strokeWidth={1.5} />
    </TextBarToggleButton>
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

/** Props for {@link TextBarColor}. */
export interface TextBarColorProps {
  editor: Editor
  state: TextState
  swatches: readonly string[]
  /** Seeds the swatch from the selection's role when no colour override is set (`StyleValue` and `ThemeTextRole` share the same four values), so it tracks a Global style edit. */
  theme: ProposalTheme
}

/** The Text colour `ColorPopover`. Focus is deliberately not forced on pick (mirrors the Branding bubble's `CaretSafeColor`): forcing it while dragging the picker would fight the picker's own inputs. */
export function TextBarColor({ editor, state, swatches, theme }: TextBarColorProps) {
  const value = state.color ?? theme.text[state.style].color
  return (
    <Tooltip side="top" label="Text colour">
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
