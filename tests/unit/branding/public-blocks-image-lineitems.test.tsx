import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { RenderImage } from '@/lib/branding/public-blocks/image'
import { RenderLineItems } from '@/lib/branding/public-blocks/line-items'
import type { PublicDocData } from '@/lib/branding/public-blocks/shared'

const branding = {
  density: 'cozy',
  corner_radius: 8,
  brand_color: '#111',
  surface_color: '#fff',
  text_color: '#111',
  muted_color: '#666',
  font_body: 'system-ui',
  font_body_weight: 400,
} as never

describe('public image block', () => {
  it('renders null when block has no url', () => {
    const { container } = render(<RenderImage block={{ id: 'img', type: 'image' }} branding={branding} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the image element with correct styling', () => {
    const { container } = render(
      <RenderImage
        block={{ id: 'img', type: 'image', url: 'https://example.com/image.png', heightPx: 200 }}
        branding={branding}
      />,
    )
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', 'https://example.com/image.png')
    expect(img).toHaveClass('select-none')
  })

  it('renders chrome element when provided', () => {
    render(
      <RenderImage
        block={{ id: 'img', type: 'image', url: 'https://example.com/image.png' }}
        branding={branding}
        chrome={<div data-testid="test-chrome">Chrome Content</div>}
      />,
    )
    expect(screen.getByTestId('test-chrome')).toBeInTheDocument()
    expect(screen.getByText('Chrome Content')).toBeInTheDocument()
  })

  it('applies imageInteraction ref and onMouseDown handlers', () => {
    const containerRef = createRef<HTMLDivElement | null>()
    const onMouseDown = vi.fn()

    const { container } = render(
      <RenderImage
        block={{ id: 'img', type: 'image', url: 'https://example.com/image.png' }}
        branding={branding}
        imageInteraction={{
          ref: containerRef,
          onMouseDown,
          panning: false,
        }}
      />,
    )

    const outerDiv = container.querySelector('div')
    expect(outerDiv).toBe(containerRef.current)
  })

  it('applies correct cursor classes based on panning state', () => {
    const { rerender, container } = render(
      <RenderImage
        block={{ id: 'img', type: 'image', url: 'https://example.com/image.png' }}
        branding={branding}
        imageInteraction={{
          ref: createRef(),
          panning: false,
        }}
      />,
    )
    expect(container.querySelector('div')).toHaveClass('cursor-grab')

    rerender(
      <RenderImage
        block={{ id: 'img', type: 'image', url: 'https://example.com/image.png' }}
        branding={branding}
        imageInteraction={{
          ref: createRef(),
          panning: true,
        }}
      />,
    )
    expect(container.querySelector('div')).toHaveClass('cursor-grabbing')
  })

  it('applies pan/zoom positioning to the image', () => {
    const { container } = render(
      <RenderImage
        block={{
          id: 'img',
          type: 'image',
          url: 'https://example.com/image.png',
          imageX: 75,
          imageY: 25,
          imageScale: 1.5,
        }}
        branding={branding}
      />,
    )
    const img = container.querySelector('img') as HTMLImageElement
    expect(img.style.objectPosition).toContain('75')
    expect(img.style.objectPosition).toContain('25')
    expect(img.style.transform).toContain('1.5')
  })
})

describe('public line-items block layout parity', () => {
  const sampleDoc: PublicDocData = {
    title: 'Sample',
    refNumber: 'TEST-001',
    expiresAt: '2026-12-31',
    items: [
      { id: '1', description: 'Service A', amount: 100, quantity: 1, unit_price: 100 },
      { id: '2', description: 'Service B', amount: 200, quantity: 2, unit_price: 100 },
    ],
    subtotal: 300,
    taxRate: 0,
  }

  it('renders line items with correct layout structure', () => {
    const { container } = render(
      <RenderLineItems
        block={{ id: 'li', type: 'lineItems', colSpread: false }}
        branding={branding}
        doc={sampleDoc}
      />,
    )

    // Verify that items are rendered
    expect(screen.getByText('Service A')).toBeInTheDocument()
    expect(screen.getByText('Service B')).toBeInTheDocument()

    // Verify structure - each row should have description and amount
    const rows = container.querySelectorAll('div.flex.items-start')
    expect(rows.length).toBe(sampleDoc.items.length)
  })

  it('applies correct flex classes based on colSpread setting', () => {
    const { container: containerSpread } = render(
      <RenderLineItems
        block={{ id: 'li', type: 'lineItems', colSpread: true }}
        branding={branding}
        doc={sampleDoc}
      />,
    )

    const rowSpread = containerSpread.querySelector('div.flex.items-start')
    expect(rowSpread).toHaveClass('justify-between')

    const { container: containerNoSpread } = render(
      <RenderLineItems
        block={{ id: 'li', type: 'lineItems', colSpread: false }}
        branding={branding}
        doc={sampleDoc}
      />,
    )

    const rowNoSpread = containerNoSpread.querySelector('div.flex.items-start')
    expect(rowNoSpread).toHaveClass('gap-4')
  })

  it('applies amount alignment based on colSpread value', () => {
    const { container } = render(
      <RenderLineItems
        block={{ id: 'li', type: 'lineItems', colSpread: true }}
        branding={branding}
        doc={sampleDoc}
      />,
    )

    // Find amount spans (last span in each row)
    const rows = container.querySelectorAll('div.flex.items-start')
    rows.forEach((row) => {
      const amounts = row.querySelectorAll('span')
      const lastSpan = amounts[amounts.length - 1]
      expect(lastSpan).toHaveClass('shrink-0')
    })
  })

  it('renders no line items message when doc is empty', () => {
    render(
      <RenderLineItems
        block={{ id: 'li', type: 'lineItems' }}
        branding={branding}
        doc={{ ...sampleDoc, items: [] }}
      />,
    )
    expect(screen.getByText('No line items.')).toBeInTheDocument()
  })
})
