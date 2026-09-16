'use client'

import { Video as VideoIcon } from 'lucide-react'
import { useRef, useState } from 'react'

import { publicBrandingFromEditorState } from '@/app/(dashboard)/branding/editor-branding'
import { PROPOSAL_MEDIA_TYPES } from '@/app/(dashboard)/branding/upload-proposal-media'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { VideoPlayer } from '@/lib/branding/public-blocks/proposal/media'
import { RenderVideo, type VideoSlots } from '@/lib/branding/public-blocks/proposal/video'
import type { BrandPreviewState, SurfaceTab } from '@/types/branding-preview'

import type { ProposalRenderExtras, UpdateBlock } from '../render-proposal'
import type { VideoBlock } from '../types'

import { MediaReplaceRemove, UploadProgressBar } from './media-overlay'
import { ProposalText } from './proposal-text'

interface EditVideoProps {
  block: VideoBlock
  state: BrandPreviewState
  surface: SurfaceTab
  updateBlock: UpdateBlock
  extras: ProposalRenderExtras
}

/**
 * Editor renderer for the proposal video block: composes the public
 * `RenderVideo` with an upload slot (video only; there is no image option
 * here, unlike the hero) and an inline-editable caption.
 */
export function EditVideo({ block, state, updateBlock, extras }: EditVideoProps) {
  const branding = publicBrandingFromEditorState(state)
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const uploaded = block.source?.kind === 'upload' ? block.source : null
  const { toast } = useToast()

  const handleFile = async (file: File | null | undefined) => {
    if (!file || !extras.uploadVideo) return
    setProgress(0)
    try {
      const url = await extras.uploadVideo(file, `video-${block.id}.mp4`, setProgress)
      updateBlock<VideoBlock>(block.id, { source: { kind: 'upload', url } })
    } catch {
      // uploadVideoCb already toasts a user-facing message via onError; this
      // only stops the rejection from surfacing as an unhandled promise.
    } finally {
      setProgress(null)
    }
  }

  const remove = async () => {
    try {
      await extras.removeAsset?.('proposal-media', `video-${block.id}.mp4`)
      updateBlock<VideoBlock>(block.id, { source: null })
    } catch {
      toast('Could not remove video', 'error')
    }
  }

  const slots: VideoSlots = {
    media: (
      <div className="group/media relative h-full w-full">
        {uploaded ? (
          <>
            <VideoPlayer url={uploaded.url} posterUrl={uploaded.posterUrl} frame="document" />
            <MediaReplaceRemove onReplace={() => inputRef.current?.click()} onRemove={remove} />
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center border-2 border-dashed border-border bg-gray-50/40">
            <Button variant="secondary" onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}>
              <VideoIcon size={14} strokeWidth={1.5} />
              Upload video
            </Button>
          </div>
        )}
        {progress !== null && <UploadProgressBar pct={progress} brandColor={state.brandColor} />}
        <input
          ref={inputRef}
          type="file"
          accept={PROPOSAL_MEDIA_TYPES.join(',')}
          className="hidden"
          onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = '' }}
        />
      </div>
    ),
    caption: (
      <ProposalText
        subtarget="caption"
        value={block.caption}
        onChange={(v) => updateBlock<VideoBlock>(block.id, { caption: v })}
        placeholder="Add a caption"
      />
    ),
  }

  return <RenderVideo block={block} branding={branding} frame="document" slots={slots} />
}
