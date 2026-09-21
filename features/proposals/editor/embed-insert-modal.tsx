'use client'

/**
 * The "Embed a video" modal `InsertMediaHost` opens for the embed insert
 * item: a URL `Input` gated by the same `detectEmbedProvider` allowlist
 * `extensions/embed.ts`'s `setEmbed` command uses, sharing `node-bar-embed.tsx`'s
 * `EMBED_ERROR` copy so a rejected host reads the same whether it was
 * typed here (a brand-new node) or in the node bar's Replace-link popover
 * (an existing one). Insert only fires `insertAtomNode` - never a bare
 * `url: null` placeholder - so no half-built embed can ever reach the doc
 * through this path (see the final review's Finding 2).
 *
 * @module features/proposals/editor/embed-insert-modal
 */
import type { Editor } from '@tiptap/react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'

import { detectEmbedProvider } from '../model/rich-doc-spec'

import { EMBED_ERROR } from './bars/node-bar-embed'
import { insertAtomNode } from './insert-atom-node'

/** Props for {@link EmbedInsertModal}. */
export interface EmbedInsertModalProps {
  /** The editor to insert into once a valid url is given; `null` while closed. */
  editor: Editor | null
  onClose: () => void
}

/** Prompts for an embed url, validates it, and inserts the node - node-selected - on success. */
export function EmbedInsertModal({ editor, onClose }: EmbedInsertModalProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)

  const close = () => {
    onClose()
    setValue('')
    setError(undefined)
  }

  const insert = () => {
    if (!editor || detectEmbedProvider(value) === null) {
      setError(EMBED_ERROR)
      return
    }
    insertAtomNode(editor, 'embed', { url: value })
    close()
  }

  return (
    <Modal isOpen={editor !== null} onClose={close} title="Embed a video" size="sm">
      <div className="flex flex-col gap-3">
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
            insert()
          }}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button onClick={insert}>Insert</Button>
        </div>
      </div>
    </Modal>
  )
}
