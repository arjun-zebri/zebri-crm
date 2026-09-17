'use client'

/**
 * The text bar's `+` insert menu: `INSERT_ITEMS` (Task 8), the same
 * list and order the `/` slash menu shows. The Variable row has no
 * self-contained insert (see `insert-items.ts`'s own doc comment); it
 * calls `editor.storage.proposalEditor.callbacks.requestVariable`, and
 * this component is the one that registers that callback (a small
 * `PROPOSAL_VARIABLES` list shown in the same popover), so a variable
 * inserted from the `/` menu (which has no picker of its own either)
 * works too, not just the one reachable from this bar's own row.
 *
 * @module features/proposals/editor/bars/text-bar-insert
 */
import * as Popover from '@radix-ui/react-popover'
import type { Editor } from '@tiptap/react'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'

import { MenuItem, MenuPanel } from '@/components/ui/menu'
import { Tooltip } from '@/components/ui/tooltip'

import { PROPOSAL_VARIABLES } from '../../model/variables'
import { INSERT_ITEMS } from '../insert-items'

import { TEXT_BAR_MENU_ATTR, toggleButtonClass } from './text-bar-style'

/** Which body the popover shows: the insert list, or (after picking Variable, from here or the `/` menu) the variable list. */
type InsertView = 'closed' | 'items' | 'variables'

/** The `+` insert menu and its variable sub-list. */
export function TextBarInsert({ editor }: { editor: Editor }) {
  const [view, setView] = useState<InsertView>('closed')

  useEffect(() => {
    // Registered for the lifetime of this bar, so the `/` menu's Variable
    // row (which has no picker UI of its own) opens this one instead.
    editor.commands.setProposalEditorCallbacks({ requestVariable: () => setView('variables') })
    return () => {
      // A no-op, not `undefined`: `exactOptionalPropertyTypes` treats an
      // explicit `undefined` differently from an omitted key, and this
      // merges into the stored callbacks either way. The point is only
      // that nothing calls `setView` after this component has unmounted.
      editor.commands.setProposalEditorCallbacks({ requestVariable: () => {} })
    }
  }, [editor])

  return (
    <Popover.Root open={view !== 'closed'} onOpenChange={(open) => setView(open ? 'items' : 'closed')}>
      <Tooltip label="Insert">
        <Popover.Trigger asChild>
          <button type="button" aria-label="Insert" className={toggleButtonClass(false)}>
            <Plus size={14} strokeWidth={1.5} />
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content {...TEXT_BAR_MENU_ATTR} align="start" sideOffset={6} className="z-[60] animate-modal-in">
          <MenuPanel width="sm" className="max-h-[320px] overflow-y-auto">
            {view === 'variables'
              ? PROPOSAL_VARIABLES.map((v) => (
                  <MenuItem
                    key={v.id}
                    onClick={() => {
                      editor.chain().focus().insertContent({ type: 'variable', attrs: { id: v.id } }).run()
                      setView('closed')
                    }}
                  >
                    {v.label}
                  </MenuItem>
                ))
              : INSERT_ITEMS.map((item) => (
                  <MenuItem
                    key={item.id}
                    onClick={() => {
                      item.run(editor)
                      // The Variable row's own `run` calls the callback above,
                      // which already switched `view` to 'variables'; every
                      // other row inserts outright and should close.
                      if (item.id !== 'variable') setView('closed')
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <item.icon size={14} strokeWidth={1.5} />
                      {item.label}
                    </span>
                  </MenuItem>
                ))}
          </MenuPanel>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
