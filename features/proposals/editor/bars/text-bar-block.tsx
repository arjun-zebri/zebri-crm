'use client'

/**
 * The text bar's Align pill (left/center/right). The Bulleted/Numbered
 * list toggles that used to live alongside it moved into the bar's
 * `...` overflow menu (`text-bar-overflow.tsx`), per the controller's
 * ruling on the bar's 380px overflow threshold.
 *
 * @module features/proposals/editor/bars/text-bar-block
 */
import type { Editor } from '@tiptap/react'
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react'

import { PillToggle } from '@/components/editor'

import { applyTextStyle, type TextState } from './text-bar-style'

/** The Align pill: left / center / right, via `setTextAlign`. */
export function TextBarAlign({ editor, state }: { editor: Editor; state: TextState }) {
  return (
    <PillToggle<'left' | 'center' | 'right'>
      value={state.align}
      onChange={(v) => applyTextStyle(editor, { align: v })}
      options={[
        { value: 'left', label: 'Align left', icon: <AlignLeft size={12} strokeWidth={1.5} /> },
        { value: 'center', label: 'Align center', icon: <AlignCenter size={12} strokeWidth={1.5} /> },
        { value: 'right', label: 'Align right', icon: <AlignRight size={12} strokeWidth={1.5} /> },
      ]}
    />
  )
}
