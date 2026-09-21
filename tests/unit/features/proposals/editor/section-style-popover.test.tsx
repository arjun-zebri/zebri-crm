// tests/unit/features/proposals/editor/section-style-popover.test.tsx
/**
 * `SectionStylePopover` (UX audit §3.5, a major): the labelled Style
 * popover holding every control the old flat `SectionBar` exposed -
 * background, width, height, padding, text colour, alignment, hide on
 * phone, reset. Every write still goes through
 * `dispatch({ type: 'updateStyle', id, patch })`; nothing here needs the
 * popover pre-opened: the component renders its own Style trigger button.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
  doc, newSectionFor, paragraph, SectionStylePopover, text, type LayoutAction, type Section, defaultTheme,
} from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const THEME = defaultTheme(buildPublicBranding({ business_name: 'Sam MC' }))

/** A content section, optionally pre-filled with text (empty otherwise, per `isSectionEmpty`). */
function contentSection(body: string | null): Section {
  const section = newSectionFor('content')
  return body === null ? section : { ...section, content: doc(paragraph(text(body))) }
}

function openPopover(section: Section, dispatch = vi.fn()) {
  const boundsRef = createRef<HTMLElement>()
  render(<SectionStylePopover section={section} theme={THEME} dispatch={dispatch} boundsRef={boundsRef} />)
  fireEvent.click(screen.getByRole('button', { name: 'Style' }))
  return dispatch
}

/** The most recent `updateStyle` patch dispatched, across every call, so far. */
function patches(dispatch: ReturnType<typeof vi.fn>): Array<Partial<Record<string, unknown>>> {
  return dispatch.mock.calls
    .map(([action]) => action as LayoutAction)
    .filter((a): a is Extract<LayoutAction, { type: 'updateStyle' }> => a.type === 'updateStyle')
    .map((a) => a.patch)
}

describe('SectionStylePopover', () => {
  it('clicking the Width "Wide" pill dispatches updateStyle with contentWidth: wide', () => {
    const dispatch = openPopover(contentSection(null))
    fireEvent.click(screen.getByRole('button', { name: 'Wide' }))
    expect(patches(dispatch)).toContainEqual(expect.objectContaining({ contentWidth: 'wide' }))
  })

  it('clicking the Height "Full" pill dispatches updateStyle with height: full', () => {
    const dispatch = openPopover(contentSection(null))
    fireEvent.click(screen.getByRole('button', { name: 'Full' }))
    expect(patches(dispatch)).toContainEqual(expect.objectContaining({ height: 'full' }))
  })

  it('the Height pill stays available in step flow, where Full means "fill this page"', () => {
    const dispatch = vi.fn()
    render(<SectionStylePopover section={contentSection(null)} theme={{ ...THEME, flow: 'step' }} dispatch={dispatch} boundsRef={createRef<HTMLElement>()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Style' }))
    fireEvent.click(screen.getByRole('button', { name: 'Full' }))
    expect(patches(dispatch)).toContainEqual(expect.objectContaining({ height: 'full' }))
  })

  it('clicking the Alignment "Align right" pill dispatches updateStyle with align: right', () => {
    const dispatch = openPopover(contentSection(null))
    fireEvent.click(screen.getByRole('button', { name: 'Align right' }))
    expect(patches(dispatch)).toContainEqual({ align: 'right' })
  })

  it('clicking the Vertical align "Align bottom" pill dispatches updateStyle with verticalAlign: bottom', () => {
    const dispatch = openPopover(contentSection(null))
    fireEvent.click(screen.getByRole('button', { name: 'Align bottom' }))
    expect(patches(dispatch)).toContainEqual({ verticalAlign: 'bottom' })
  })

  it('"Use page colour" clears an already-set text colour', () => {
    const base = contentSection(null)
    const withColor: Section = { ...base, style: { ...base.style, textColor: '#FF0000' } }
    const dispatch = openPopover(withColor)

    fireEvent.click(screen.getByRole('button', { name: 'Use page colour' }))
    expect(patches(dispatch)).toContainEqual({ textColor: undefined })
  })

  it('Vertical padding drags near a named stop snap to it, in px, and commit on release', () => {
    const dispatch = openPopover(contentSection(null))

    fireEvent.click(screen.getByRole('button', { name: 'Vertical padding' }))
    const slider = screen.getByRole('slider', { name: 'Vertical padding' })
    // Fresh 'content' sections start at 'cozy' (48px); nudging by 1 should
    // snap right back to 'cozy' rather than drift to 49.
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(patches(dispatch)).toContainEqual({ padding: 'cozy' })
  })

  it('Horizontal padding is its own control: inherits the theme (32px, "Cozy") and stores a px number that snaps to the horizontal stops', () => {
    const dispatch = openPopover(contentSection(null))

    const trigger = screen.getByRole('button', { name: 'Horizontal padding' })
    expect(trigger).toHaveTextContent('Cozy')
    fireEvent.click(trigger)
    const slider = screen.getByRole('slider', { name: 'Horizontal padding' })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(patches(dispatch)).toContainEqual({ paddingX: 32 })
    // The stepper's +8 lands on 40, which is no stop, so it stays a number.
    fireEvent.click(screen.getByRole('button', { name: 'Increase Horizontal padding' }))
    expect(patches(dispatch)).toContainEqual({ paddingX: 40 })
  })

  it('Hide on phone dispatches toggleHideOnMobile', () => {
    const section = contentSection(null)
    const dispatch = openPopover(section)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide on phone' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'toggleHideOnMobile', id: section.id }, { commit: true })
  })

  it('Reset style dispatches resetStyle', () => {
    const section = contentSection(null)
    const dispatch = openPopover(section)
    fireEvent.click(screen.getByRole('button', { name: 'Reset style' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'resetStyle', id: section.id }, { commit: true })
  })

  it('a gallery section shows its own Layout row; picking Masonry commits setData', () => {
    const section = newSectionFor('gallery')
    const dispatch = openPopover(section)
    fireEvent.click(screen.getByRole('button', { name: 'Masonry' }))
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'setData', id: section.id, data: { kind: 'gallery', gallery: { ...(section.data as Extract<Section['data'], { kind: 'gallery' }>).gallery, layout: 'masonry' } } },
      { commit: true },
    )
  })

  it('a content section has no Layout row', () => {
    openPopover(contentSection(null))
    expect(screen.queryByText('Layout')).not.toBeInTheDocument()
  })

  it('a gallery section in grid layout has no carousel colour rows', () => {
    openPopover(newSectionFor('gallery'))
    expect(screen.queryByRole('button', { name: 'Carousel background' })).not.toBeInTheDocument()
  })

  it('a gallery section in carousel layout shows Carousel background/icon colour rows (2026-09-19 feedback)', () => {
    const section = newSectionFor('gallery')
    const galleryData = (section.data as Extract<Section['data'], { kind: 'gallery' }>).gallery
    const carouselSection: Section = { ...section, data: { kind: 'gallery', gallery: { ...galleryData, layout: 'carousel' } } }
    openPopover(carouselSection)
    expect(screen.getByRole('button', { name: 'Carousel background' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Carousel icon colour' })).toBeInTheDocument()
  })

  it('"Use brand colour" clears an already-set gallery carousel background', () => {
    const section = newSectionFor('gallery')
    const galleryData = (section.data as Extract<Section['data'], { kind: 'gallery' }>).gallery
    const carouselSection: Section = {
      ...section,
      data: { kind: 'gallery', gallery: { ...galleryData, layout: 'carousel', carouselBackgroundColor: '#FF0000' } },
    }
    const dispatch = openPopover(carouselSection)
    fireEvent.click(screen.getByRole('button', { name: 'Use brand colour' }))
    expect(dispatch).toHaveBeenCalledWith(
      {
        type: 'setData',
        id: carouselSection.id,
        data: { kind: 'gallery', gallery: { ...galleryData, layout: 'carousel', carouselBackgroundColor: undefined } },
      },
      { commit: true },
    )
  })

  it('a packages section with mobileLayout carousel shows Carousel background/icon colour rows', () => {
    const section = newSectionFor('packages')
    const packagesData = (section.data as Extract<Section['data'], { kind: 'packages' }>).packages
    const carouselSection: Section = { ...section, data: { kind: 'packages', packages: { ...packagesData, mobileLayout: 'carousel' } } }
    openPopover(carouselSection)
    expect(screen.getByRole('button', { name: 'Carousel background' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Carousel icon colour' })).toBeInTheDocument()
  })

  it('a packages section with mobileLayout stack has no carousel colour rows', () => {
    openPopover(newSectionFor('packages'))
    expect(screen.queryByRole('button', { name: 'Carousel background' })).not.toBeInTheDocument()
  })

  it('a testimonials section shows its own Layout row; picking Carousel commits setData', () => {
    const section = newSectionFor('testimonials')
    const dispatch = openPopover(section)
    fireEvent.click(screen.getByRole('button', { name: 'Carousel' }))
    expect(dispatch).toHaveBeenCalledWith(
      {
        type: 'setData',
        id: section.id,
        data: { kind: 'testimonials', testimonials: { ...(section.data as Extract<Section['data'], { kind: 'testimonials' }>).testimonials, layout: 'carousel' } },
      },
      { commit: true },
    )
  })

  it('a testimonials section in cards layout has an On phone row', () => {
    openPopover(newSectionFor('testimonials'))
    expect(screen.getByText('On phone')).toBeInTheDocument()
  })

  it('a testimonials section in carousel layout has no On phone row (it is already one-at-a-time everywhere)', () => {
    const section = newSectionFor('testimonials')
    const data = (section.data as Extract<Section['data'], { kind: 'testimonials' }>).testimonials
    const carouselSection: Section = { ...section, data: { kind: 'testimonials', testimonials: { ...data, layout: 'carousel' } } }
    openPopover(carouselSection)
    expect(screen.queryByText('On phone')).not.toBeInTheDocument()
  })

  it('a testimonials section in cards layout with mobileLayout carousel shows Carousel background/icon colour rows', () => {
    const section = newSectionFor('testimonials')
    const data = (section.data as Extract<Section['data'], { kind: 'testimonials' }>).testimonials
    const carouselSection: Section = { ...section, data: { kind: 'testimonials', testimonials: { ...data, mobileLayout: 'carousel' } } }
    openPopover(carouselSection)
    expect(screen.getByRole('button', { name: 'Carousel background' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Carousel icon colour' })).toBeInTheDocument()
  })

  it('a testimonials section in cards layout with mobileLayout stack has no carousel colour rows', () => {
    openPopover(newSectionFor('testimonials'))
    expect(screen.queryByRole('button', { name: 'Carousel background' })).not.toBeInTheDocument()
  })

  it('a testimonials section shows a Card background row', () => {
    openPopover(newSectionFor('testimonials'))
    expect(screen.getAllByText('Card background')).toHaveLength(1)
  })

  describe('video Corner rounding (2026-09-19 feedback)', () => {
    function openVideoPopover(section: Section, brandCornerRadius: number, dispatch = vi.fn()) {
      render(<SectionStylePopover section={section} theme={THEME} dispatch={dispatch} boundsRef={createRef<HTMLElement>()} brandCornerRadius={brandCornerRadius} />)
      fireEvent.click(screen.getByRole('button', { name: 'Style' }))
      return dispatch
    }

    it('shows the brand radius until the section sets its own', () => {
      openVideoPopover(newSectionFor('video'), 12)
      expect(screen.getByRole('spinbutton', { name: 'Corner rounding' })).toHaveValue(12)
    })

    it('shows the section\'s own radius once set', () => {
      const section = newSectionFor('video')
      const video = (section.data as Extract<Section['data'], { kind: 'video' }>).video
      openVideoPopover({ ...section, data: { kind: 'video', video: { ...video, cornerRadius: 24 } } }, 12)
      expect(screen.getByRole('spinbutton', { name: 'Corner rounding' })).toHaveValue(24)
    })

    it('stepping up commits setData with the new cornerRadius on the video data alone', () => {
      const section = newSectionFor('video')
      const dispatch = openVideoPopover(section, 12)
      fireEvent.click(screen.getByRole('button', { name: 'Increase Corner rounding' }))
      expect(dispatch).toHaveBeenCalledWith(
        { type: 'setData', id: section.id, data: { kind: 'video', video: { ...(section.data as Extract<Section['data'], { kind: 'video' }>).video, cornerRadius: 14 } } },
        { commit: true },
      )
    })

    it('a non-video section has no Corner rounding row', () => {
      openPopover(newSectionFor('gallery'))
      expect(screen.queryByText('Corner rounding')).not.toBeInTheDocument()
    })
  })

  describe('FAQ Collapsible answers (2026-09-19 feedback)', () => {
    it('defaults to checked (unset reads as on)', () => {
      openPopover(newSectionFor('faq'))
      expect(screen.getByRole('checkbox', { name: 'Collapsible answers' })).toBeChecked()
    })

    it('unchecking commits setData with collapsible: false', () => {
      const section = newSectionFor('faq')
      const dispatch = openPopover(section)
      fireEvent.click(screen.getByRole('checkbox', { name: 'Collapsible answers' }))
      expect(dispatch).toHaveBeenCalledWith(
        { type: 'setData', id: section.id, data: { kind: 'faq', faq: { ...(section.data as Extract<Section['data'], { kind: 'faq' }>).faq, collapsible: false } } },
        { commit: true },
      )
    })

    it('a non-faq section has no Collapsible answers row', () => {
      openPopover(newSectionFor('gallery'))
      expect(screen.queryByText('Collapsible answers')).not.toBeInTheDocument()
    })
  })

  it('a dragged custom width shows a plain "Custom" pill, never the px value (live-found bug: a 4-digit value wrapped the pill group)', () => {
    const section = contentSection(null)
    const customSection: Section = { ...section, style: { ...section.style, contentWidth: 1042 } }
    openPopover(customSection)
    expect(screen.getByRole('button', { name: 'Custom' })).toBeInTheDocument()
    expect(screen.queryByText(/1042/)).not.toBeInTheDocument()
  })
})
