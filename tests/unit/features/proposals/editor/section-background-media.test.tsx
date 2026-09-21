// tests/unit/features/proposals/editor/section-background-media.test.tsx
/**
 * The Background popover's Colour / Image / Video tabs are exclusive:
 * picking one clears the others (a transparent PNG over a leftover
 * colour was the tell). Once media is set there is Remove, and an image
 * gets Reposition: the popover closes and the section itself becomes a
 * drag surface (`editor/background-reposition.tsx`) writing
 * `background.position`, rendered as `object-position` by
 * `render/section-backdrop.tsx` so canvas and public page crop alike.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  doc, newSectionFor, paragraph, SectionStylePopover, text, uploadProposalMediaFile,
  type LayoutAction, type Section, defaultTheme,
} from '@/features/proposals'
import { dragFocalPoint } from '@/features/proposals/editor/background-reposition-math'
import { SectionBackdrop } from '@/features/proposals/render/section-backdrop'
import { buildPublicBranding } from '@/lib/branding/public-branding'

vi.mock('@/features/proposals/data/media', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/proposals/data/media')>()
  return { ...actual, uploadProposalMediaFile: vi.fn() }
})

const THEME = defaultTheme(buildPublicBranding({ business_name: 'Sam MC' }))
const IMAGE = 'https://example.supabase.co/storage/v1/object/public/proposal-media/u1/hero.jpg'
const VIDEO = 'https://example.supabase.co/storage/v1/object/public/proposal-media/u1/hero.mp4'
const POSTER = 'https://example.supabase.co/storage/v1/object/public/proposal-media/u1/hero-poster.jpg'

afterEach(() => vi.mocked(uploadProposalMediaFile).mockReset())

function sectionWith(background: NonNullable<Section['style']['background']>): Section {
  const section = newSectionFor('content')
  return { ...section, content: doc(paragraph(text('Hi'))), style: { ...section.style, background } }
}

function openBackground(section: Section, onReposition = vi.fn()) {
  const dispatch = vi.fn()
  render(
    <SectionStylePopover
      section={section} theme={THEME} dispatch={dispatch} boundsRef={createRef<HTMLElement>()}
      swatches={['#00FF00']} onReposition={onReposition}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Style' }))
  fireEvent.click(screen.getByRole('button', { name: 'Background' }))
  return dispatch
}

function lastBackground(dispatch: ReturnType<typeof vi.fn>) {
  const action = dispatch.mock.calls.at(-1)?.[0] as Extract<LayoutAction, { type: 'updateStyle' }>
  return action.patch.background
}

describe('background tabs are exclusive', () => {
  it('uploading an image drops the colour (and any video), keeping only the overlay', async () => {
    vi.mocked(uploadProposalMediaFile).mockResolvedValue(IMAGE)
    const dispatch = openBackground(sectionWith({ color: '#112233', video: VIDEO, poster: POSTER, overlay: 30 }))
    fireEvent.click(screen.getByRole('tab', { name: 'Image' }))
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(['x'], 'hero.jpg', { type: 'image/jpeg' })] } })
    })
    await waitFor(() => expect(lastBackground(dispatch)).toEqual({ overlay: 30, image: IMAGE }))
  })

  it('picking a colour drops the image and its focal point', () => {
    const dispatch = openBackground(sectionWith({ image: IMAGE, position: { x: 100, y: 0 } }))
    fireEvent.click(screen.getByRole('tab', { name: 'Colour' }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose colour' }))
    fireEvent.click(screen.getByRole('button', { name: '#00FF00' }))
    expect(lastBackground(dispatch)).toEqual({ color: '#00FF00' })
  })
})

describe('background image tab', () => {
  it('Remove drops the image and its focal point', () => {
    const dispatch = openBackground(sectionWith({ image: IMAGE, position: { x: 100, y: 0 }, overlay: 10 }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }))
    expect(lastBackground(dispatch)).toEqual({ overlay: 10 })
  })

  it('Reposition hands off to the section and closes the popover; no focal grid is offered', () => {
    const onReposition = vi.fn()
    openBackground(sectionWith({ image: IMAGE }), onReposition)
    expect(screen.queryByRole('button', { name: /^Focus / })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reposition' }))
    expect(onReposition).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('tab', { name: 'Image' })).toBeNull()
  })

  it('offers only Upload before an image is chosen', () => {
    openBackground(sectionWith({ color: '#112233' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Image' }))
    expect(screen.queryByRole('button', { name: 'Remove image' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reposition' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Upload image' })).toBeInTheDocument()
  })
})

describe('background video tab', () => {
  it('Remove drops the video and its poster', () => {
    const dispatch = openBackground(sectionWith({ video: VIDEO, poster: POSTER, overlay: 40 }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove video' }))
    expect(lastBackground(dispatch)).toEqual({ overlay: 40 })
  })
})

describe('dragFocalPoint', () => {
  // A 2000x1000 photo covering a 1000x800 box scales to 1600x800: 600px of
  // horizontal overflow, none vertical.
  const box = { w: 1000, h: 800 }
  const natural = { w: 2000, h: 1000 }

  it('dragging the image right reveals its left side (x decreases), clamped to 0', () => {
    expect(dragFocalPoint({ x: 50, y: 50 }, { dx: 300, dy: 0 }, box, natural)).toEqual({ x: 0, y: 50 })
    expect(dragFocalPoint({ x: 50, y: 50 }, { dx: 150, dy: 0 }, box, natural)).toEqual({ x: 25, y: 50 })
  })

  it('an axis with no overflow does not move', () => {
    expect(dragFocalPoint({ x: 50, y: 50 }, { dx: 0, dy: 400 }, box, natural)).toEqual({ x: 50, y: 50 })
  })

  it('a box taller than the image overflows vertically instead', () => {
    // 2000x1000 into 500x1000 scales to 2000x1000: 1500px horizontal, 0 vertical... use a portrait photo.
    expect(dragFocalPoint({ x: 50, y: 50 }, { dx: 0, dy: -100 }, { w: 400, h: 800 }, { w: 400, h: 1200 })).toEqual({ x: 50, y: 75 })
  })
})

describe('SectionBackdrop', () => {
  it('renders the focal point as object-position, defaulting to centre', () => {
    const { container, rerender } = render(<SectionBackdrop background={{ image: IMAGE, position: { x: 0, y: 100 } }} index={0} mode="page" />)
    expect(container.querySelector('img')).toHaveStyle({ objectPosition: '0% 100%' })
    rerender(<SectionBackdrop background={{ image: IMAGE }} index={0} mode="page" />)
    expect(container.querySelector('img')?.style.objectPosition).toBe('')
  })
})
