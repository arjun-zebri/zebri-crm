'use client'

import { useRef, useState } from 'react'

import { PROPOSAL_MEDIA_TYPES } from '@/app/(dashboard)/branding/upload-proposal-media'
import { useToast } from '@/components/ui/toast'
import { EmbedFrame, VideoPlayer } from '@/lib/branding/public-blocks/proposal/media'

import type { ProposalRenderExtras } from '../render-proposal'
import type { HeroBlock } from '../types'

import { AddBackgroundMenu } from './add-background-menu'
import { EmbedUrlPopover } from './embed-url-popover'
import { MediaReplaceRemove, UploadProgressBar } from './media-overlay'

/**
 * The hero's background layer in the editor: an image, a video file, or a
 * YouTube / Vimeo link. Empty, it shows a drop-zone outline inset from the
 * section edge and one Add background menu for the three sources;
 * populated, it previews the media exactly as the sent page will and shows
 * the compact Replace / Remove overlay, where Replace on an embed reopens
 * the link popover (there is no file to swap).
 */
export function HeroMediaSlot({
  block,
  brandColor,
  patch,
  extras,
}: {
  block: HeroBlock
  brandColor: string
  patch: (p: Partial<HeroBlock>) => void
  extras: ProposalRenderExtras
}) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const { toast } = useToast()

  const background = block.background
  const populated = background.kind !== 'none'

  const handleImageFile = async (file: File | null | undefined) => {
    if (!file || !extras.uploadBlockImage) return
    try {
      const url = await extras.uploadBlockImage(file, `hero-${block.id}`)
      patch({ background: { kind: 'image', url } })
    } catch {
      // uploadBlockImageCb already toasts a user-facing message via onError;
      // this only stops the rejection from surfacing as an unhandled promise.
    }
  }

  const handleVideoFile = async (file: File | null | undefined) => {
    if (!file || !extras.uploadVideo) return
    setProgress(0)
    try {
      const url = await extras.uploadVideo(file, `hero-${block.id}.mp4`, setProgress)
      patch({ background: { kind: 'video', url } })
    } catch {
      // uploadVideoCb already toasts a user-facing message via onError; this
      // only stops the rejection from surfacing as an unhandled promise.
    } finally {
      setProgress(null)
    }
  }

  const remove = async () => {
    try {
      if (background.kind === 'image') await extras.removeAsset?.('branding', `hero-${block.id}`)
      if (background.kind === 'video') await extras.removeAsset?.('proposal-media', `hero-${block.id}.mp4`)
      patch({ background: { kind: 'none' } })
    } catch {
      toast('Could not remove media', 'error')
    }
  }

  const setEmbed = (url: string) => patch({ background: { kind: 'embed', url } })

  return (
      <div className="group/media absolute inset-0">
        {populated ? (
          <>
            {background.kind === 'image' && (
              // eslint-disable-next-line @next/next/no-img-element -- editor preview of an uploaded hero image
              <img src={background.url} alt="" className="h-full w-full object-cover" />
            )}
            {background.kind === 'video' && <VideoPlayer url={background.url} background frame="document" />}
            {background.kind === 'embed' && (
              <EmbedFrame url={background.url} background frame="document" title="Hero video" className="pointer-events-none scale-[1.35]" />
            )}
            <MediaReplaceRemove
              inset="section"
              onReplace={() => (background.kind === 'image' ? imageInputRef : videoInputRef).current?.click()}
              onRemove={remove}
              // An embed has no file to swap: Replace reopens the link popover.
              {...(background.kind === 'embed'
                ? { replaceWrapper: (btn: React.ReactNode) => <EmbedUrlPopover value={background.url} onSubmit={setEmbed} trigger={btn} /> }
                : {})}
            />
          </>
        ) : (
          <div className="h-full w-full bg-surface-muted/40">
            {/* Inset from the section edge so the outline reads as a drop
                zone inside the opening, not as the block's own border. Sits
                just inside the text column's gutter (px-4 / px-8) at both
                widths so the words never cross it. */}
            <div aria-hidden className="absolute inset-3 @sm/doc:inset-6 rounded-control border border-dashed border-border-strong/60" />
            {/* Pinned to a corner at the same inset so it never sits under
                the heading, which is centred (or bottom-left) over this
                layer, and hidden while the MC is typing in either field so
                the chrome gets out of the way of the words. */}
            <div className="absolute top-4 right-4 @sm/doc:top-8 @sm/doc:right-8 transition group-has-[.ProseMirror-focused]/hero:opacity-0 group-has-[.ProseMirror-focused]/hero:pointer-events-none">
              <AddBackgroundMenu
                onUploadImage={() => imageInputRef.current?.click()}
                onUploadVideo={() => videoInputRef.current?.click()}
                onEmbed={setEmbed}
              />
            </div>
          </div>
        )}
        {progress !== null && <UploadProgressBar pct={progress} brandColor={brandColor} />}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { handleImageFile(e.target.files?.[0]); e.target.value = '' }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept={PROPOSAL_MEDIA_TYPES.join(',')}
          className="hidden"
          onChange={(e) => { handleVideoFile(e.target.files?.[0]); e.target.value = '' }}
        />
      </div>
  )
}
