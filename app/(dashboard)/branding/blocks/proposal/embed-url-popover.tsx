'use client'

import * as Popover from '@radix-ui/react-popover'
import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { parseEmbedUrl } from '@/lib/proposals/embed-url'

/**
 * A small popover that takes a YouTube / Vimeo link for a video background
 * or embed. Lives beside the Upload buttons rather than in the block
 * toolbar, since a link is a media source like a file, not a setting.
 * Validates on submit only, so pasting a long URL never toasts mid-way.
 */
export function EmbedUrlPopover({
  value,
  onSubmit,
  trigger,
}: {
  /** The current embed URL, if the media already is an embed. */
  value?: string | undefined
  onSubmit: (url: string) => void
  trigger: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-[70] bg-surface border border-border rounded-control shadow-xl p-3 w-[320px] animate-modal-in"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Mounted only while open, so a cancelled edit never lingers into
              the next opening: the form re-seeds from `value` each time. */}
          <EmbedUrlForm
            initial={value ?? ''}
            onSubmit={(url) => {
              onSubmit(url)
              setOpen(false)
            }}
            onCancel={() => setOpen(false)}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * The link field and its buttons, on their own so the empty hero's Add
 * background menu can show the same form in place of a second popover.
 * Validates on submit only, so pasting a long URL never toasts mid-way.
 */
export function EmbedUrlForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: string
  onSubmit: (url: string) => void
  onCancel: () => void
}) {
  const { toast } = useToast()
  const [url, setUrl] = useState(initial)

  const submit = () => {
    const raw = url.trim()
    if (!parseEmbedUrl(raw)) {
      toast('Only YouTube and Vimeo links can be embedded', 'error')
      return
    }
    onSubmit(raw)
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Input
        aria-label="Video link"
        label="YouTube or Vimeo link"
        value={url}
        placeholder="youtube.com/watch?v=…"
        autoFocus
        onChange={(e) => setUrl(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Use video</Button>
      </div>
    </form>
  )
}
