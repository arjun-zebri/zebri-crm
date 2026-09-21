// tests/unit/features/proposals/editor/edit-gallery.test.tsx
/**
 * Slice E2 deliverable 1: the gallery data section (UX audit 3.4). Tile
 * remove/move ("reorder-lite", no drag) commit immediately; the trailing
 * "Add photos" tile uploads through `useMediaUpload` up to the 12-image
 * cap, rendering as a big full-width invitation while there are no photos
 * yet (2026-09-18 feedback). Layout moved off a dedicated toolbar button
 * and into the section's Style popover (`section-style-popover.test.tsx`
 * covers that row) - `GalleryLayoutPopover` no longer exists.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  AddPhotosTile, gallerySlots, newSectionFor, uploadProposalMediaFile,
  type GalleryData, type Section,
} from '@/features/proposals'

vi.mock('@/features/proposals/data/media', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/proposals/data/media')>()
  return { ...actual, uploadProposalMediaFile: vi.fn() }
})

/** A `data.gallery` slice pulled off a fresh default section, with `images` overridden. */
function galleryData(images: GalleryData['images'] = []): GalleryData {
  const data = (newSectionFor('gallery').data as Extract<Section['data'], { kind: 'gallery' }>).gallery
  return { ...data, images }
}

/** `gallerySlots` with `data` overridable. */
function buildSlots(data: GalleryData, dispatch = vi.fn()) {
  return gallerySlots({ sectionId: 's1', data, dispatch, externalVersion: 0, onFocus: vi.fn() })
}

describe('gallerySlots', () => {
  afterEach(() => vi.mocked(uploadProposalMediaFile).mockReset())

  it('removing a tile commits, dropping only that image', () => {
    const dispatch = vi.fn()
    const data = galleryData([{ id: 'g1', url: 'https://cdn.example/a.jpg' }, { id: 'g2', url: 'https://cdn.example/b.jpg' }])
    const slots = buildSlots(data, dispatch)
    render(<div>{slots.tile!(data.images[0]!, 0)}</div>)
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo 1' }))
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'setData', id: 's1', data: { kind: 'gallery', gallery: { ...data, images: [data.images[1]] } } },
      { commit: true },
    )
  })

  it('moving a tile right swaps it with its neighbour and commits', () => {
    const dispatch = vi.fn()
    const data = galleryData([{ id: 'g1', url: 'a' }, { id: 'g2', url: 'b' }])
    const slots = buildSlots(data, dispatch)
    render(<div>{slots.tile!(data.images[0]!, 0)}</div>)
    fireEvent.click(screen.getByRole('button', { name: 'Move photo 1 right' }))
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'setData', id: 's1', data: { kind: 'gallery', gallery: { ...data, images: [data.images[1], data.images[0]] } } },
      { commit: true },
    )
  })

  it('hides move-left on the first tile and move-right on the last', () => {
    const data = galleryData([{ id: 'g1', url: 'a' }, { id: 'g2', url: 'b' }])
    const slots = buildSlots(data)
    render(<div>{slots.tile!(data.images[0]!, 0)}{slots.tile!(data.images[1]!, 1)}</div>)
    expect(screen.queryByRole('button', { name: 'Move photo 1 left' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Move photo 2 right' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move photo 1 right' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move photo 2 left' })).toBeInTheDocument()
  })

  it('has no heading/text-above/text-below fields (2026-09-19 feedback: "remove the text from all these sections... we can always add text sections around them")', () => {
    const slots = buildSlots(galleryData())
    expect(Object.keys(slots).sort()).toEqual(['tile', 'trailing'])
  })
})

describe('AddPhotosTile', () => {
  afterEach(() => vi.mocked(uploadProposalMediaFile).mockReset())

  it('uploads the picked file, appends it and commits', async () => {
    vi.mocked(uploadProposalMediaFile).mockResolvedValue('https://cdn.example/new.jpg')
    const dispatch = vi.fn()
    const data = galleryData()
    render(<AddPhotosTile sectionId="s1" data={data} dispatch={dispatch} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add photos' }))
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'photo.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(dispatch).toHaveBeenCalled())
    const [action, opts] = dispatch.mock.calls[0]!
    expect(opts).toEqual({ commit: true })
    expect(action.data.gallery.images).toHaveLength(1)
    expect(action.data.gallery.images[0]).toMatchObject({ url: 'https://cdn.example/new.jpg' })
  })

  it('trims a pick that would exceed the 12-image cap', async () => {
    vi.mocked(uploadProposalMediaFile).mockResolvedValueOnce('https://cdn.example/a.jpg').mockResolvedValueOnce('https://cdn.example/b.jpg')
    const dispatch = vi.fn()
    const images = Array.from({ length: 11 }, (_, i) => ({ id: `g${i}`, url: `https://cdn.example/${i}.jpg` }))
    render(<AddPhotosTile sectionId="s1" data={galleryData(images)} dispatch={dispatch} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add photos' }))
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' }), new File(['y'], 'b.jpg', { type: 'image/jpeg' })] },
    })
    await waitFor(() => expect(dispatch).toHaveBeenCalled())
    const [action] = dispatch.mock.calls[0]!
    expect(action.data.gallery.images).toHaveLength(12)
  })

  it('shows "12 photos max" and disables adding at the cap', () => {
    const images = Array.from({ length: 12 }, (_, i) => ({ id: `g${i}`, url: `https://cdn.example/${i}.jpg` }))
    render(<AddPhotosTile sectionId="s1" data={galleryData(images)} dispatch={vi.fn()} />)
    expect(screen.getByRole('button', { name: '12 photos max' })).toBeDisabled()
  })

  it('reads as a big invitation while there are no photos yet', () => {
    render(<AddPhotosTile sectionId="s1" data={galleryData()} dispatch={vi.fn()} />)
    expect(screen.getByText('Add as many as you want')).toBeInTheDocument()
  })

  it('drops the "add as many as you want" copy once the gallery has a photo', () => {
    const data = galleryData([{ id: 'g1', url: 'https://cdn.example/a.jpg' }])
    render(<AddPhotosTile sectionId="s1" data={data} dispatch={vi.fn()} />)
    expect(screen.queryByText('Add as many as you want')).not.toBeInTheDocument()
  })
})
