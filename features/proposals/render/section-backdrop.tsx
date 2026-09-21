'use client'

/**
 * The three background layers behind a section's content column: an image,
 * a muted looping video, and a black overlay over either. Extracted out of
 * `SectionView` (Phase 1) so the editor canvas (`editor/editable-section.tsx`,
 * Phase 2) can build the same section chrome around a live `ContentSectionEditor`
 * without duplicating the markup - a background must look identical while
 * editing and on the live page.
 *
 * @module features/proposals/render/section-backdrop
 */
import { VideoPlayer } from '@/lib/branding/public-blocks/proposal/media'

import type { SectionBackground } from '../model/layout'

import { isHttpUrl, type RenderMode } from './rich-doc'

/** Props for {@link SectionBackdrop}. */
export interface SectionBackdropProps {
  /** The section's background config, or `undefined` for a plain-colour/no-background section. */
  background: SectionBackground | undefined
  /** The section's position in the layout; only the first section's image loads eagerly. */
  index: number
  mode: RenderMode
}

/** Renders a section's background image/video and its overlay; renders nothing when the section has neither. */
export function SectionBackdrop({ background, index, mode }: SectionBackdropProps) {
  const overlay = Math.min(100, Math.max(0, background?.overlay ?? 0)) / 100
  return (
    <>
      {background?.image && isHttpUrl(background.image) ? (
        // eslint-disable-next-line @next/next/no-img-element -- MC-uploaded section background
        <img
          src={background.image}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          // The MC's focal point (`section-background-media.tsx`); the
          // browser's own default is already `50% 50%`, so unset stays unset.
          style={background.position ? { objectPosition: `${background.position.x}% ${background.position.y}%` } : undefined}
          fetchPriority={index === 0 ? 'high' : 'auto'}
        />
      ) : null}
      {background?.video && isHttpUrl(background.video) ? (
        <div className="absolute inset-0">
          <VideoPlayer
            url={background.video}
            posterUrl={background.poster && isHttpUrl(background.poster) ? background.poster : undefined}
            background
            frame={mode === 'print' ? 'print' : 'page'}
          />
        </div>
      ) : null}
      {(background?.image || background?.video) && overlay > 0 ? (
        <div aria-hidden data-section-overlay className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlay})` }} />
      ) : null}
    </>
  )
}
