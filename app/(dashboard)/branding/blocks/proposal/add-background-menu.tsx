'use client'

import * as Popover from '@radix-ui/react-popover'
import { ChevronDown, Image as ImageIcon, Link as LinkIcon, Plus, Video as VideoIcon } from 'lucide-react'
import { useState } from 'react'

import { MenuItem, MenuPanel } from '@/components/ui/menu'

import { EmbedUrlForm } from './embed-url-popover'

/**
 * The empty hero's one control for choosing a background: a small pill that
 * opens a menu of the three sources (upload an image, upload a video, paste
 * a YouTube / Vimeo link). Picking the link swaps the menu for the URL form
 * in the same popover, so there is one surface to dismiss, not two. One
 * pill instead of three buttons keeps the empty opening quiet enough that
 * the heading, not the chrome, is what the MC reads first.
 */
export function AddBackgroundMenu({
  onUploadImage,
  onUploadVideo,
  onEmbed,
}: {
  onUploadImage: () => void
  onUploadVideo: () => void
  onEmbed: (url: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'menu' | 'link'>('menu')
  const close = () => {
    setOpen(false)
    setView('menu')
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Add background"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-2 rounded-control bg-surface/90 border border-border text-body font-medium text-text shadow-sm hover:bg-surface cursor-pointer transition"
        >
          <Plus size={14} strokeWidth={1.5} />
          Add background
          <ChevronDown size={10} strokeWidth={2} className="text-text-subtle" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-[70] outline-none animate-modal-in"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {view === 'menu' ? (
            <MenuPanel>
              <MenuItem size="sm" onClick={() => { close(); onUploadImage() }}>
                <span className="inline-flex items-center gap-2"><ImageIcon size={14} strokeWidth={1.5} />Upload image</span>
              </MenuItem>
              <MenuItem size="sm" onClick={() => { close(); onUploadVideo() }}>
                <span className="inline-flex items-center gap-2"><VideoIcon size={14} strokeWidth={1.5} />Upload video</span>
              </MenuItem>
              <MenuItem size="sm" onClick={() => setView('link')}>
                <span className="inline-flex items-center gap-2"><LinkIcon size={14} strokeWidth={1.5} />YouTube or Vimeo link</span>
              </MenuItem>
            </MenuPanel>
          ) : (
            <div className="bg-surface border border-border rounded-control shadow-xl p-3 w-[320px]">
              <EmbedUrlForm initial="" onSubmit={(url) => { onEmbed(url); close() }} onCancel={close} />
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
