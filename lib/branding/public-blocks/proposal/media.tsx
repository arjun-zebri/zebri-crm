'use client'

import { parseEmbedUrl, embedIframeSrc } from '@/lib/proposals/embed-url'

import type { FrameMode } from '../shared'

/**
 * Shared video surface for the hero and video proposal blocks: an uploaded
 * MP4/WebM. `background` autoplays muted + looped (hero use); the print
 * frame never plays media, so it renders the poster image only.
 */
export function VideoPlayer({
  url,
  posterUrl,
  background = false,
  frame,
  className = '',
}: {
  url: string
  posterUrl?: string | undefined
  background?: boolean
  frame: FrameMode
  className?: string
}) {
  if (frame === 'print') {
    // A poster image stands in for the video in a static/printed frame.
    return posterUrl ? (
      // No `loading="lazy"` deliberately: the print frame renders everything
      // for a single static snapshot (PDF/printed page), where lazy-loading
      // has no browser viewport to defer against and would risk a blank image.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={posterUrl} alt="" className={`block w-full h-full object-cover ${className}`} />
    ) : (
      <div className={`h-full w-full ${className}`} />
    )
  }
  return (
    <video
      src={url}
      poster={posterUrl}
      className={`block w-full h-full object-cover ${className}`}
      playsInline
      preload="metadata"
      {...(background ? { autoPlay: true, muted: true, loop: true } : { controls: true })}
    />
  )
}

/**
 * Shared embed surface for the hero and video proposal blocks: a YouTube /
 * Vimeo iframe built from a share URL. Null for any other host (the embed
 * was already validated when saved; this is a defensive second check) or
 * whenever the frame is `print`, which never plays media.
 */
export function EmbedFrame({
  url,
  background = false,
  frame,
  title,
  className = '',
}: {
  url: string
  background?: boolean
  frame: FrameMode
  title: string
  className?: string
}) {
  const parsed = parseEmbedUrl(url)
  if (!parsed || frame === 'print') return null
  return (
    <iframe
      src={embedIframeSrc(parsed, { background })}
      title={title}
      className={`block w-full h-full ${className}`}
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen={!background}
      referrerPolicy="strict-origin-when-cross-origin"
    />
  )
}
