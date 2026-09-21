'use client'

/**
 * The video source prompt (Slice E2, UX audit 3.4): a URL `Input`
 * validated with `parseEmbedUrl` - the same YouTube/Vimeo parser
 * `RenderVideo`'s `EmbedFrame` actually plays back
 * (`lib/branding/public-blocks/proposal/media.tsx`) - plus a secondary
 * "Upload a video instead" hand-off. Deliberately not `detectEmbedProvider`
 * (`model/rich-doc-spec.ts`): that allowlist also covers Spotify/Google
 * Maps/Instagram for the generic rich-text `embed` node, none of which a
 * `VideoBlock` source can ever render, so validating against it here would
 * let the editor save a link the public page then shows nothing for.
 *
 * A separate component rather than reusing `../embed-insert-modal.tsx`:
 * that modal is coupled to a TipTap `Editor` (it calls `insertAtomNode`
 * directly), while a video section's source is a plain `dispatch` value.
 *
 * @module features/proposals/editor/data/video-source-modal
 */
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { parseEmbedUrl } from '@/lib/proposals/embed-url'

/** Shown when the pasted url is not a YouTube or Vimeo share link. */
export const VIDEO_URL_ERROR = 'Paste a valid YouTube or Vimeo link'

/** Props for {@link VideoSourceModal}. */
export interface VideoSourceModalProps {
  isOpen: boolean
  onClose: () => void
  /** Fired with an already-validated url on submit. */
  onSubmitUrl: (url: string) => void
  onUploadInstead: () => void
}

/** Prompts for a video embed url, or hands off to a file upload instead. */
export function VideoSourceModal({ isOpen, onClose, onSubmitUrl, onUploadInstead }: VideoSourceModalProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)

  const close = () => {
    onClose()
    setValue('')
    setError(undefined)
  }

  const submit = () => {
    if (parseEmbedUrl(value) === null) {
      setError(VIDEO_URL_ERROR)
      return
    }
    onSubmitUrl(value)
    setValue('')
    setError(undefined)
  }

  return (
    <Modal isOpen={isOpen} onClose={close} title="Add a video" size="sm">
      <div className="flex flex-col gap-3">
        <Input
          label="Video link"
          value={value}
          placeholder="https://…"
          {...(error ? { error } : {})}
          autoFocus
          onChange={(e) => { setValue(e.target.value); setError(undefined) }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            submit()
          }}
        />
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onUploadInstead}>Upload a video instead</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button onClick={submit}>Add</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
