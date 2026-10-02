'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'

/** Props for {@link SongArtwork}. */
export interface SongArtworkProps {
  /** Spotify CDN cover URL, or null for a typed song. */
  src: string | null
  className?: string
  style?: CSSProperties
  /** Rendered instead when there is no cover or it fails to load. */
  fallback?: ReactNode
}

/**
 * A song's album cover that degrades to `fallback` (default: nothing)
 * when the song has no cover or Spotify no longer serves it, rather than
 * showing the browser's broken-image glyph.
 */
export function SongArtwork({ src, className, style, fallback = null }: SongArtworkProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  if (!src || failedSrc === src) return <>{fallback}</>
  return (
    // Spotify CDN covers (CHECK-constrained to i.scdn.co); next/image would
    // need a remote loader for thumbnails Spotify already serves small.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={className} style={style} onError={() => setFailedSrc(src)} />
  )
}
