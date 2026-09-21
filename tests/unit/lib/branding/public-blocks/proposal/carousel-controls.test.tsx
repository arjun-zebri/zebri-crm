import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { getTextColor } from '@/lib/branding/contrast'
import { CarouselControls } from '@/lib/branding/public-blocks/proposal/carousel-controls'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const branding = buildPublicBranding({ business_name: 'Sam MC', brand_color: '#1D4ED8' })

describe('CarouselControls', () => {
  it('defaults the arrow background to the brand colour and the icon to its auto contrast', () => {
    render(
      <CarouselControls branding={branding} index={0} count={2} noun="photo" onPrev={vi.fn()} onNext={vi.fn()} onSelect={vi.fn()} />,
    )
    const next = screen.getByRole('button', { name: 'Next photo' })
    expect(next.style.background).toBe('rgb(29, 78, 216)')
    expect(next.style.color).toBe(getTextColor(branding.brand_color) === '#ffffff' ? 'rgb(255, 255, 255)' : 'rgb(17, 24, 39)')
  })

  it('a set carousel background/icon colour overrides the arrow buttons and the active dot (2026-09-19 feedback)', () => {
    render(
      <CarouselControls
        branding={branding}
        index={1}
        count={2}
        noun="photo"
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onSelect={vi.fn()}
        backgroundColor="#FF00AA"
        iconColor="#00FF00"
      />,
    )
    const next = screen.getByRole('button', { name: 'Next photo' })
    expect(next.style.background).toBe('rgb(255, 0, 170)')
    expect(next.style.color).toBe('rgb(0, 255, 0)')
    const activeDot = screen.getByRole('button', { name: 'Go to photo 2' })
    expect(activeDot.style.background).toBe('rgb(255, 0, 170)')
    const inactiveDot = screen.getByRole('button', { name: 'Go to photo 1' })
    expect(inactiveDot.style.background).not.toBe('rgb(255, 0, 170)')
  })

  it('an overridden background still gets a legible icon by default (auto-contrasts against the override, not the brand colour)', () => {
    render(
      <CarouselControls
        branding={branding}
        index={0}
        count={2}
        noun="photo"
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onSelect={vi.fn()}
        backgroundColor="#111827"
      />,
    )
    const next = screen.getByRole('button', { name: 'Next photo' })
    expect(next.style.color).toBe(`rgb(${getTextColor('#111827') === '#ffffff' ? '255, 255, 255' : '17, 24, 39'})`)
  })

  it('renders nothing for a single item', () => {
    const { container } = render(
      <CarouselControls branding={branding} index={0} count={1} noun="photo" onPrev={vi.fn()} onNext={vi.fn()} onSelect={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })
})
