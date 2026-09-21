'use client'

/**
 * The "Add an image" modal `InsertMediaHost` opens for the image insert
 * item: the account's uploaded images from the `proposal-media` bucket
 * (click one to insert it) plus an Upload button for a new file. This is
 * where the old library panel's Images tab moved when the panel was
 * removed (its Blocks tab duplicated the add palette, so the panel went;
 * the image library was the one thing it had that nothing else did), so
 * "Image" in the `/` slash menu and the text bar's `+` menu now offers
 * reuse before it offers the OS file picker.
 *
 * Both paths end in the same `insertAtomNode` call with the same attrs
 * the host's former direct-upload branch used, targeting `editor` - the
 * editor whose insert menu made the request - so the inserted node is
 * node-selected and its node bar opens immediately.
 *
 * @module features/proposals/editor/image-insert-modal
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Editor } from '@tiptap/react'
import { ImageIcon, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { ErrorState } from '@/components/ui/error-state'
import { Loading } from '@/components/ui/loading'
import { Modal } from '@/components/ui/modal'

import { listProposalImages } from '../data/media'

import { useMediaUpload } from './data/use-media-upload'
import { insertAtomNode } from './insert-atom-node'
import { LibraryImageGrid } from './library/library-image-grid'

/** react-query key for the account's proposal image library, shared by the load and the post-upload invalidation. */
export const PROPOSAL_IMAGES_QUERY_KEY = ['proposal-media', 'image'] as const

/** Props for {@link ImageInsertModal}. */
export interface ImageInsertModalProps {
  /** The editor to insert into; `null` while closed. */
  editor: Editor | null
  onClose: () => void
}

/** Inserts `url` into `editor` as a full-width inline image, the same attrs every image insert path uses. */
function insertImage(editor: Editor, url: string) {
  insertAtomNode(editor, 'image', { src: url, alt: '', layout: 'inline', widthPct: 100 })
}

/** Picks an image from the account library, or uploads a new one, and inserts it into the requesting editor. */
export function ImageInsertModal({ editor, onClose }: ImageInsertModalProps) {
  const open = editor !== null
  const qc = useQueryClient()
  // `enabled: open` so a template editor that never inserts an image never
  // lists the bucket; `refetchOnWindowFocus` off since Upload below already
  // invalidates this key, so a focus-triggered refetch would only ever
  // repeat that same round trip.
  const query = useQuery({
    queryKey: PROPOSAL_IMAGES_QUERY_KEY, queryFn: listProposalImages, enabled: open, retry: false, refetchOnWindowFocus: false,
  })
  const images = query.data ?? []
  const { pick, input } = useMediaUpload()

  const choose = (url: string) => {
    if (!editor) return
    insertImage(editor, url)
    onClose()
  }

  const upload = () => {
    // The modal stays open (with the upload pill) until the file lands,
    // then inserts it and closes: `onDone` never fires for a failed
    // upload, so the pill's own error state stays visible for retry.
    pick('image', undefined, (urls) => {
      void qc.invalidateQueries({ queryKey: PROPOSAL_IMAGES_QUERY_KEY })
      const url = urls[0]
      if (url) choose(url)
    })
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Add an image" size="md">
      <div className="space-y-3">
        <Button variant="secondary" onClick={upload} className="w-full justify-center gap-1.5">
          <Upload size={16} strokeWidth={1.5} />
          Upload image
        </Button>
        {input}
        {query.isLoading ? (
          <Loading label="Loading images" />
        ) : query.error ? (
          <ErrorState title="Couldn't load images" onRetry={() => void query.refetch()} />
        ) : images.length === 0 ? (
          <Empty
            size="sm"
            icon={ImageIcon}
            title="No images yet"
            description="Upload one and it'll be here to reuse in every template."
            className="py-6"
          />
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <LibraryImageGrid images={images} onInsert={choose} />
          </div>
        )}
      </div>
    </Modal>
  )
}
