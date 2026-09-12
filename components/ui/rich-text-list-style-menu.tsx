'use client'

import * as Popover from '@radix-ui/react-popover'
import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { MenuItem, MenuLabel, MenuPanel, MenuSeparator } from '@/components/ui/menu'
import {
  CONTRACT_LIST_STYLES,
  LEGAL_SCHEME,
  activeListScheme,
  effectiveListStyle,
} from '@/lib/contracts/list-styles'

/**
 * The numbering-format picker that sits beside the numbered-list button.
 *
 * A split button: the trigger shows the glyph of the list under the caret
 * (`1.`, `1.1`, `(a)`) so the MC can see what they are in, and the menu opens
 * with a **Legal** preset first, which numbers the whole tree `1.` / `1.1` /
 * `(a)` / `(i)` by depth in one click (later Tab-indented sub-lists follow it
 * too), then the eight per-list formats. Picking a per-list row sets the
 * format on the list under the caret only (see `setListStyle`), so each
 * level can be changed on its own, inside a preset or not; if the caret is
 * not in a list, one is started.
 *
 * Rendered only when {@link RichTextEditor} is given `listStyles`, which
 * contract surfaces opt into because their renderer registers the extension
 * (the `ol[data-list-style]` marker CSS in `globals.css` is global).
 */
export function ListStyleMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  // Re-render on every selection change so the glyph tracks the caret.
  const { current, scheme } = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      current: effectiveListStyle(e.state),
      scheme: activeListScheme(e.state),
    }),
  })
  const glyph = CONTRACT_LIST_STYLES.find((s) => s.id === (current ?? 'decimal'))?.example ?? '1.'

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        title="Numbering format"
        // Matches the sibling toolbar buttons; hangs off the list button as
        // the second half of a split control.
        className={`flex items-center gap-0.5 pl-1 pr-0.5 py-1.5 ml-2 rounded-control transition cursor-pointer text-body tabular-nums hover:bg-surface-emphasis ${
          current ? 'text-gray-900' : 'text-gray-600'
        }`}
      >
        <span>{glyph}</span>
        <ChevronDown size={12} strokeWidth={1.5} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-[90] animate-fade-in">
          <MenuPanel width="lg">
            <MenuLabel>Whole list</MenuLabel>
            <MenuItem
              size="sm"
              selected={scheme === LEGAL_SCHEME}
              onClick={() => {
                // Picking it again clears the preset.
                editor
                  .chain()
                  .focus()
                  .setListScheme(scheme === LEGAL_SCHEME ? null : LEGAL_SCHEME)
                  .run()
                setOpen(false)
              }}
            >
              <span className="inline-block w-8 font-medium tabular-nums">1.1</span>
              Legal: 1. / 1.1 / (a) / (i)
            </MenuItem>
            <MenuSeparator />
            <MenuLabel>This level</MenuLabel>
            {CONTRACT_LIST_STYLES.map((style) => (
              <MenuItem
                key={style.id}
                size="sm"
                selected={current === style.id}
                onClick={() => {
                  editor.chain().focus().setListStyle(style.id).run()
                  setOpen(false)
                }}
              >
                <span className="inline-block w-8 font-medium tabular-nums">{style.example}</span>
                {style.label}
              </MenuItem>
            ))}
          </MenuPanel>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
