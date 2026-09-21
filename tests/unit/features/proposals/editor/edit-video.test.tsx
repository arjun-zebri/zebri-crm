// tests/unit/features/proposals/editor/edit-video.test.tsx
/**
 * Slice E2 deliverable 2: the video data section (UX audit 3.4). The
 * `media` slot always renders something - an empty-state card with
 * "Paste a link"/"Upload", or the real player with a Replace/Remove
 * overlay - so `RenderVideo`'s "no source, no `media` slot -> render
 * nothing" branch (`lib/branding/public-blocks/proposal/video.tsx`) never
 * leaves an empty video section invisible on the canvas. No heading or
 * caption slot (2026-09-19: "no text above or below the main content" -
 * a text section stacked above/below is the way to add either).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { newSectionFor, uploadProposalMediaFile, videoSlots, type Section, type VideoData } from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

vi.mock('@/features/proposals/data/media', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/proposals/data/media')>()
  return { ...actual, uploadProposalMediaFile: vi.fn() }
})

const branding = buildPublicBranding({ business_name: 'Sam MC' })

/** A `data.video` slice pulled off a fresh default section, patched. */
function videoData(patch: Partial<VideoData> = {}): VideoData {
  const data = (newSectionFor('video').data as Extract<Section['data'], { kind: 'video' }>).video
  return { ...data, ...patch }
}

/** `videoSlots` args, `branding` included (mirrors `edit-packages.test.tsx`'s own `args` helper). */
function slotArgs(overrides: Partial<Parameters<typeof videoSlots>[0]> = {}): Parameters<typeof videoSlots>[0] {
  return { sectionId: 's1', data: videoData(), dispatch: vi.fn(), externalVersion: 0, onFocus: vi.fn(), branding, ...overrides }
}

describe('videoSlots', () => {
  afterEach(() => vi.mocked(uploadProposalMediaFile).mockReset())

  it('offers only the media slot: no heading or caption field above or below the video', () => {
    const slots = videoSlots(slotArgs())
    expect(Object.keys(slots)).toEqual(['media'])
    expect((slots as { heading?: unknown }).heading).toBeUndefined()
    expect((slots as { caption?: unknown }).caption).toBeUndefined()
  })

  it('renders an empty-state card with Paste a link / Upload when there is no source', () => {
    const data = videoData({ source: null })
    render(<div>{videoSlots(slotArgs({ data })).media}</div>)
    expect(screen.getByText('Add a video')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Paste a link' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument()
  })

  it('"Paste a link" opens the source modal; an invalid url shows an error and dispatches nothing', () => {
    const dispatch = vi.fn()
    const data = videoData({ source: null })
    render(<div>{videoSlots(slotArgs({ data, dispatch })).media}</div>)
    fireEvent.click(screen.getByRole('button', { name: 'Paste a link' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Video link' }), { target: { value: 'https://example.com/x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByText('Paste a valid YouTube or Vimeo link')).toBeInTheDocument()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('a valid YouTube url sets an embed source and commits', () => {
    const dispatch = vi.fn()
    const data = videoData({ source: null })
    render(<div>{videoSlots(slotArgs({ data, dispatch })).media}</div>)
    fireEvent.click(screen.getByRole('button', { name: 'Paste a link' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Video link' }), { target: { value: 'https://youtu.be/abc12345678' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(dispatch).toHaveBeenCalledWith(
      {
        type: 'setData', id: 's1',
        data: { kind: 'video', video: { ...data, source: { kind: 'embed', url: 'https://youtu.be/abc12345678' } } },
      },
      { commit: true },
    )
  })

  it('uploading a file sets an upload source and commits', async () => {
    vi.mocked(uploadProposalMediaFile).mockResolvedValue('https://cdn.example/v.mp4')
    const dispatch = vi.fn()
    const data = videoData({ source: null })
    render(<div>{videoSlots(slotArgs({ data, dispatch })).media}</div>)
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'clip.mp4', { type: 'video/mp4' })] } })
    await waitFor(() => expect(dispatch).toHaveBeenCalled())
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'setData', id: 's1', data: { kind: 'video', video: { ...data, source: { kind: 'upload', url: 'https://cdn.example/v.mp4' } } } },
      { commit: true },
    )
  })

  it('Remove clears the source and commits', () => {
    const dispatch = vi.fn()
    const data = videoData({ source: { kind: 'embed', url: 'https://youtu.be/abc12345678' } })
    render(<div>{videoSlots(slotArgs({ data, dispatch })).media}</div>)
    fireEvent.click(screen.getByRole('button', { name: 'Remove video' }))
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'setData', id: 's1', data: { kind: 'video', video: { ...data, source: null } } },
      { commit: true },
    )
  })

  describe('resize (2026-09-19: "resize just the video, dots on the corners")', () => {
    it('has no resize grips until the video is clicked, then shows four corner dots', () => {
      const data = videoData({ source: { kind: 'embed', url: 'https://youtu.be/abc12345678' } })
      render(<div>{videoSlots(slotArgs({ data })).media}</div>)
      expect(screen.queryByRole('slider')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Select video' }))
      expect(screen.getByRole('slider', { name: 'Video size, top-left corner' })).toBeInTheDocument()
      expect(screen.getByRole('slider', { name: 'Video size, top-right corner' })).toBeInTheDocument()
      expect(screen.getByRole('slider', { name: 'Video size, bottom-left corner' })).toBeInTheDocument()
      expect(screen.getByRole('slider', { name: 'Video size, bottom-right corner' })).toBeInTheDocument()
    })

    it('the grips sit outside the clipped/rounded player box, not inside it (a corner dot straddling the edge was being cropped to invisible)', () => {
      const data = videoData({ source: { kind: 'embed', url: 'https://youtu.be/abc12345678' } })
      const { container } = render(<div>{videoSlots(slotArgs({ data })).media}</div>)
      fireEvent.click(screen.getByRole('button', { name: 'Select video' }))
      const clipped = container.querySelector('.overflow-hidden')
      const grip = screen.getByRole('slider', { name: 'Video size, top-left corner' })
      expect(clipped).not.toBeNull()
      expect(clipped?.contains(grip)).toBe(false)
    })

    it('keeps a shield over the player while selected - a cross-origin iframe swallows the mousemove a drag runs on', () => {
      const data = videoData({ source: { kind: 'embed', url: 'https://youtu.be/abc12345678' } })
      const { container } = render(<div>{videoSlots(slotArgs({ data })).media}</div>)
      expect(container.querySelector('[data-video-shield]')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Select video' }))
      expect(screen.queryByRole('button', { name: 'Select video' })).not.toBeInTheDocument()
      expect(container.querySelector('[data-video-shield]')).not.toBeNull()
    })

    it('clicking outside the video deselects it, hiding the grips again', () => {
      const data = videoData({ source: { kind: 'embed', url: 'https://youtu.be/abc12345678' } })
      render(<div>{videoSlots(slotArgs({ data })).media}</div>)
      fireEvent.click(screen.getByRole('button', { name: 'Select video' }))
      expect(screen.getByRole('slider', { name: 'Video size, top-right corner' })).toBeInTheDocument()
      fireEvent.mouseDown(document.body)
      expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    })

    it('dragging a corner resizes the box live from local state (no dispatch mid-drag) and commits once on mouse up', () => {
      const dispatch = vi.fn()
      const data = videoData({ source: { kind: 'embed', url: 'https://youtu.be/abc12345678' }, widthPx: 500 })
      const { container } = render(<div>{videoSlots(slotArgs({ data, dispatch })).media}</div>)
      const box = container.firstElementChild!.firstElementChild as HTMLElement
      expect(box.style.width).toBe('500px')
      fireEvent.click(screen.getByRole('button', { name: 'Select video' }))
      const grip = screen.getByRole('slider', { name: 'Video size, bottom-right corner' })
      fireEvent.mouseDown(grip, { clientX: 100 })
      fireEvent.mouseMove(window, { clientX: 160 })
      // The box follows the pointer immediately (the "px numbers change but
      // the size does not" live bug), from local state: the global editor
      // store - and with it the whole canvas and the live embed - must not
      // re-render on every pointer-move (the "extremely slow" live bug).
      expect(box.style.width).toBe('560px')
      expect(screen.getByText('560px')).toBeInTheDocument()
      expect(dispatch).not.toHaveBeenCalled()
      fireEvent.mouseUp(window)
      expect(dispatch).toHaveBeenCalledTimes(1)
      expect(dispatch).toHaveBeenCalledWith(
        { type: 'setData', id: 's1', data: { kind: 'video', video: { ...data, widthPx: 560 } } },
        { commit: true },
      )
    })

    it('with no saved width the box is the full column width, not a stored default', () => {
      const data = videoData({ source: { kind: 'embed', url: 'https://youtu.be/abc12345678' } })
      const { container } = render(<div>{videoSlots(slotArgs({ data })).media}</div>)
      const box = container.firstElementChild!.firstElementChild as HTMLElement
      expect(box.style.width).toBe('100%')
    })

    it('a narrower box sits where the section alignment says, via the column\'s `--doc-box-margin` (centred when unset), same as the public page', () => {
      const data = videoData({ source: { kind: 'embed', url: 'https://youtu.be/abc12345678' }, widthPx: 500 })
      const { container } = render(<div>{videoSlots(slotArgs({ data })).media}</div>)
      const box = container.firstElementChild!.firstElementChild as HTMLElement
      expect(box.style.marginInline).toBe('var(--doc-box-margin, auto)')
    })
  })
})
