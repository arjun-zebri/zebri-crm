'use client'

/**
 * The text bar's Link control: a popover holding one `Input` for the
 * href, an Apply that writes the `link` mark over the whole link (or
 * the current selection, for a fresh link), and a Remove shown only
 * when the selection already carries one. Controlled from the outside
 * (`open`/`onOpenChange`) so `text-bar.tsx` can also open it
 * imperatively via its `openLink()` ref handle (Task 15's `Meta+K`).
 *
 * @module features/proposals/editor/bars/link-popover
 */
import * as Popover from '@radix-ui/react-popover'
import type { Editor } from '@tiptap/react'
import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { TEXT_BAR_MENU_ATTR } from './text-bar-style'

/** `http(s)`, `mailto` and `tel` only (the same allowlist `model/schema.ts`'s `safeHref` enforces server-side), checked again here so the popover rejects `javascript:`/`data:` before it ever reaches TipTap. */
export const LINK_PATTERN = /^(https?:\/\/|mailto:|tel:)/i

/** Shown under the input when {@link LINK_PATTERN} rejects the value. */
export const LINK_ERROR = 'Links must start with https://, mailto: or tel:'

/** Props for {@link LinkPopover}. */
export interface LinkPopoverProps {
  editor: Editor
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The trigger element; the popover opens `asChild` off it, same as `ColorPopover`. */
  trigger: ReactNode
}

/** The Link control's popover: an href input, Apply, and Remove when a link is already active. */
export function LinkPopover({ editor, open, onOpenChange, trigger }: LinkPopoverProps) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          {...TEXT_BAR_MENU_ATTR}
          align="start"
          sideOffset={6}
          className="z-[60] w-[280px] animate-modal-in rounded-control border border-border bg-surface p-3 shadow-xl"
        >
          {/* Remounted fresh every time the popover opens (Radix unmounts
              `Popover.Content` while closed), which is what seeds `value`
              from the editor's current link on each open without an
              effect syncing a prop into state. */}
          <LinkPopoverBody editor={editor} onDone={() => onOpenChange(false)} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function LinkPopoverBody({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const hasLink = editor.isActive('link')
  const [value, setValue] = useState(() => (editor.getAttributes('link').href as string | undefined) ?? '')
  const [error, setError] = useState<string | undefined>(undefined)

  const apply = () => {
    if (!LINK_PATTERN.test(value)) {
      setError(LINK_ERROR)
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: value }).run()
    onDone()
  }

  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    onDone()
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        label="Link"
        value={value}
        placeholder="https://…"
        // `error` is only spread when set: `InputProps.error` is `string`,
        // not `string | undefined`, and `exactOptionalPropertyTypes`
        // treats passing an explicit `undefined` as a type error distinct
        // from the prop being absent.
        {...(error ? { error } : {})}
        // The popover only opens on a deliberate click (Link button, or Meta+K); landing the caret in the field it exists for is the whole point.
        autoFocus
        onChange={(e) => {
          setValue(e.target.value)
          setError(undefined)
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          apply()
        }}
      />
      <div className="flex items-center justify-end gap-2">
        {hasLink ? (
          <Button variant="ghost" onClick={remove}>Remove</Button>
        ) : null}
        <Button onClick={apply}>Apply</Button>
      </div>
    </div>
  )
}
