/**
 * Compose modal for the `add_note` step.
 *
 * A note is prose, and prose written five rows at a time inside a
 * 380px canvas node is prose written through a letterbox. Same
 * treatment as the email and task steps: the node opens this.
 *
 * Plain text rather than the rich editor: the handler appends the
 * rendered string to `couples.notes`, which is a text column, so
 * formatting would be thrown away on the way in. Variables still get
 * the composer's "Insert variable" menu — a token list is a menu, and
 * the tokens land at the caret.
 *
 * @module app/(dashboard)/automations/[id]/note-composer-modal
 */
'use client'

import * as Popover from '@radix-ui/react-popover'
import { AtSign } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { MenuItem, MenuLabel, MenuPanel } from '@/components/ui/menu'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { VARIABLE_CATALOGUE } from '@/lib/automations/variables'

interface Props {
  isOpen: boolean
  onClose: () => void
  /** The step's saved config. Read once per open, not live-bound. */
  config: Record<string, unknown>
  onSave: (draft: Record<string, unknown>) => void
}

export function NoteComposerModal({ isOpen, onClose, config, onSave }: Props) {
  const [text, setText] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const fieldRef = useRef<HTMLTextAreaElement | null>(null)
  // Where the caret was before the popover took focus. A textarea's
  // own selection collapses the moment the trigger is clicked, so it
  // has to be remembered while the field still has it.
  const caretRef = useRef<number | null>(null)

  /** Drop a token in at the caret, or at the end if there isn't one. */
  function insertVariable(token: string) {
    const at = caretRef.current ?? text.length
    const next = `${text.slice(0, at)}${token}${text.slice(at)}`
    setText(next)
    setPickerOpen(false)
    // Put the caret after what was just inserted, so a second token
    // does not land in front of the first.
    const after = at + token.length
    caretRef.current = after
    requestAnimationFrame(() => {
      const field = fieldRef.current
      if (!field) return
      field.focus()
      field.setSelectionRange(after, after)
    })
  }

  // Hydrate on open, not on every config change: re-seeding mid-edit
  // would fight typing.
  useEffect(() => {
    if (!isOpen) return
    setText(typeof config['text'] === 'string' ? config['text'] : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add note"
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            // The runner requires the text; saving without it leaves a
            // step that fails on its first run.
            disabled={!text.trim()}
            onClick={() => {
              onSave({ ...config, text })
              onClose()
            }}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Textarea
          ref={fieldRef}
          label="Note"
          rows={10}
          onSelect={(e) => {
            caretRef.current = (e.target as HTMLTextAreaElement).selectionStart
          }}
          // Fixed layout: dragging the field taller only pushes the
          // variable list around inside an already-sized modal.
          resizable={false}
          placeholder="What should be written on the couple's record when this runs?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          help="Appended to the couple's notes with today's date."
        />

        {/* Same control as the email composer's, since it is the same
            job: a list of tokens is a menu, not a wall of pills. */}
        <Popover.Root open={pickerOpen} onOpenChange={setPickerOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-control border border-border bg-surface px-3 text-body text-text-muted transition-colors hover:border-border-strong hover:text-text"
            >
              <AtSign size={13} strokeWidth={1.5} />
              Insert variable
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            {/* z-[90]: the shared popover tier, above the modal panel. */}
            <Popover.Content align="start" sideOffset={6} className="z-[90]">
              <MenuPanel width="lg" className="max-h-72 overflow-y-auto">
                {VARIABLE_CATALOGUE.map((group) => (
                  <div key={group.group}>
                    <MenuLabel>{group.group}</MenuLabel>
                    {group.variables.map((variable) => (
                      <MenuItem
                        key={variable.token}
                        onClick={() => insertVariable(variable.token)}
                      >
                        <span className="flex w-full items-baseline justify-between gap-3">
                          <span className="truncate">{variable.label}</span>
                          <span className="shrink-0 text-text-subtle">{variable.example}</span>
                        </span>
                      </MenuItem>
                    ))}
                  </div>
                ))}
              </MenuPanel>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

      </div>
    </Modal>
  )
}
