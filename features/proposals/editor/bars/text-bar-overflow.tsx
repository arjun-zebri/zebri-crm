'use client'

/**
 * The text bar's trailing `...` overflow menu: the Bulleted/Numbered
 * list toggles, the Typography section (font weight, line height,
 * letter spacing, top spacing - `text-bar-typography-panel.tsx`, the
 * Qwilr-parity pass) and the five `Aa` case choices (None/Sentence/
 * Capitalize/UPPER/lower). All moved out of the primary row on review:
 * `constraints.md`'s "Overflow `...` when a bar would not fit at 380px"
 * rule applies to this bar too, and the full control set (Style, Font,
 * Size, Weight, Colour, Italic, Underline, Strike, Align, list toggles,
 * Link, Insert, case, typography) does not fit in one 32px row at that
 * width. The list toggles keep a checkbox reading (each is
 * independently on or off); the case choices are mutually exclusive,
 * so they use a selected/trailing-check reading instead.
 *
 * @module features/proposals/editor/bars/text-bar-overflow
 */
import * as Popover from '@radix-ui/react-popover'
import type { Editor } from '@tiptap/react'
import { Check, List, ListOrdered, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'

import { MenuItem, MenuLabel, MenuPanel, MenuSeparator } from '@/components/ui/menu'
import { Tooltip } from '@/components/ui/tooltip'

import type { ProposalTheme } from '../../model/theme'

import type { CaseValue, TextState } from './text-bar-style'
import { applyTextStyle, TEXT_BAR_MENU_ATTR, toggleButtonClass } from './text-bar-style'
import { TextBarTypographyPanel } from './text-bar-typography-panel'

/** The `Aa` case select's five choices, in menu order. */
const CASE_ITEMS: ReadonlyArray<{ value: CaseValue; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'sentence', label: 'Sentence' },
  { value: 'capitalize', label: 'Capitalize' },
  { value: 'uppercase', label: 'UPPER' },
  { value: 'lowercase', label: 'lower' },
]

/** Props for {@link TextBarOverflow}. */
export interface TextBarOverflowProps {
  editor: Editor
  state: TextState
  /** Fed straight to `TextBarTypographyPanel`'s theme-default seeding. */
  theme: ProposalTheme
}

/** The bar's trailing `...` menu: the list toggles, the Typography section, then the `Aa` case choices. */
export function TextBarOverflow({ editor, state, theme }: TextBarOverflowProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Tooltip side="top" label="More">
        <Popover.Trigger asChild>
          <button type="button" aria-label="More" className={toggleButtonClass(false)}>
            <MoreHorizontal size={14} strokeWidth={1.5} />
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content {...TEXT_BAR_MENU_ATTR} align="end" sideOffset={6} className="z-[60] animate-modal-in">
          <MenuPanel width="lg">
            <MenuItem
              checked={state.bulletList}
              onClick={() => applyTextStyle(editor, { bulletList: !state.bulletList })}
            >
              <span className="flex items-center gap-2">
                <List size={14} strokeWidth={1.5} />
                Bulleted list
              </span>
            </MenuItem>
            <MenuItem
              checked={state.orderedList}
              onClick={() => applyTextStyle(editor, { orderedList: !state.orderedList })}
            >
              <span className="flex items-center gap-2">
                <ListOrdered size={14} strokeWidth={1.5} />
                Numbered list
              </span>
            </MenuItem>
            <MenuSeparator />
            <MenuLabel>Typography</MenuLabel>
            <TextBarTypographyPanel editor={editor} state={state} theme={theme} />
            <MenuSeparator />
            {CASE_ITEMS.map((item) => {
              const active = state.textCase === item.value
              return (
                <MenuItem
                  key={item.value}
                  selected={active}
                  trailing={active ? <Check size={12} strokeWidth={1.5} /> : null}
                  onClick={() => applyTextStyle(editor, { textCase: item.value })}
                >
                  {item.label}
                </MenuItem>
              )
            })}
          </MenuPanel>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
