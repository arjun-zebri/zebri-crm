// tests/unit/features/proposals/editor/gallery-height-handle.test.tsx
/**
 * `GalleryHeightHandle` (2026-09-18 feedback: "this should be resizeable
 * images"): a bottom-edge grip on a gallery section's content column,
 * dragging every tile's row height (`GalleryData.tileHeight`).
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { GalleryHeightHandle, newSectionFor, type GalleryData, type Section } from '@/features/proposals'

const RECT = { left: 0, top: 0, width: 600, height: 400 }

function galleryData(overrides: Partial<GalleryData> = {}): GalleryData {
  const data = (newSectionFor('gallery').data as Extract<Section['data'], { kind: 'gallery' }>).gallery
  return { ...data, ...overrides }
}

describe('GalleryHeightHandle', () => {
  it('renders nothing before the column has been measured', () => {
    const { container } = render(<GalleryHeightHandle sectionId="s1" data={galleryData()} rect={null} dispatch={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('starts from the default row height when tileHeight is unset', () => {
    render(<GalleryHeightHandle sectionId="s1" data={galleryData()} rect={RECT} dispatch={vi.fn()} />)
    expect(screen.getByRole('slider', { name: 'Gallery photo height' })).toHaveAttribute('aria-valuenow', '280')
  })

  it('starts from the stored tileHeight when set', () => {
    render(<GalleryHeightHandle sectionId="s1" data={galleryData({ tileHeight: 320 })} rect={RECT} dispatch={vi.fn()} />)
    expect(screen.getByRole('slider', { name: 'Gallery photo height' })).toHaveAttribute('aria-valuenow', '320')
  })

  it('an ArrowDown nudge dispatches setData with the new tileHeight, uncommitted', () => {
    const dispatch = vi.fn()
    const data = galleryData({ tileHeight: 200 })
    render(<GalleryHeightHandle sectionId="s1" data={data} rect={RECT} dispatch={dispatch} />)
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Gallery photo height' }), { key: 'ArrowDown' })
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'setData', id: 's1', data: { kind: 'gallery', gallery: { ...data, tileHeight: 201 } } },
      undefined,
    )
  })
})
