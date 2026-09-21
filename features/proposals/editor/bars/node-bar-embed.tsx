'use client'

/**
 * The `embed` node's control bar (Proposal Layout v2 Phase 2, spec §4):
 * a Replace-link popover (an `Input` + Apply, gated by
 * `detectEmbedProvider` the same way `extensions/embed.ts`'s `setEmbed`
 * command is) and Remove.
 *
 * @module features/proposals/editor/bars/node-bar-embed
 */
import * as Popover from '@radix-ui/react-popover'
import type { Editor } from '@tiptap/react'
import { Link as LinkIcon, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'

import { detectEmbedProvider } from '../../model/rich-doc-spec'
import type { EmbedNodeAttrs } from '../extensions/embed'
import type { NodeSelection } from '../state'

import { removeNode, useNodeAttrs, writeNodeAttrs } from './node-bar-shared'

/** Shown under the popover's Apply when the URL's host is not allowlisted. */
export const EMBED_ERROR = 'That site cannot be embedded'

/** Props for {@link NodeBarEmbed}. */
export interface NodeBarEmbedProps {
  node: NonNullable<NodeSelection>
  editor: Editor
}

/** The `embed` node's control bar. */
export function NodeBarEmbed({ node, editor }: NodeBarEmbedProps) {
  const attrs = useNodeAttrs<EmbedNodeAttrs>(editor, node.pos, 'embed')
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(attrs?.url ?? '')
  const [error, setError] = useState<string | undefined>(undefined)
  if (!attrs) return null

  const apply = () => {
    if (detectEmbedProvider(value) === null) {
      setError(EMBED_ERROR)
      return
    }
    writeNodeAttrs(editor, node.pos, { url: value })
    setOpen(false)
  }

  return (
    <>
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (next) {
            // Remounts fresh from the node's current url every time the
            // popover opens, mirroring `link-popover.tsx`'s own reasoning.
            setValue(attrs.url ?? '')
            setError(undefined)
          }
        }}
      >
        <Tooltip side="top" label="Replace link">
          <Popover.Trigger asChild>
            <button
              type="button"
              aria-label="Replace link"
              className="inline-flex h-8 w-8 items-center justify-center rounded-control text-text-muted hover:bg-surface-emphasis hover:text-text"
            >
              <LinkIcon size={14} strokeWidth={1.5} />
            </button>
          </Popover.Trigger>
        </Tooltip>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} className="z-[60] w-[280px] animate-modal-in rounded-control border border-border bg-surface p-3 shadow-xl">
            <div className="flex flex-col gap-2">
              <Input
                label="Embed link"
                value={value}
                placeholder="https://…"
                {...(error ? { error } : {})}
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
              <div className="flex justify-end">
                <Button onClick={apply}>Apply</Button>
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <Tooltip side="top" label="Remove">
        <Button variant="ghost" iconOnly aria-label="Remove" onClick={() => removeNode(editor, node.pos)}>
          <Trash2 size={14} strokeWidth={1.5} />
        </Button>
      </Tooltip>
    </>
  )
}
