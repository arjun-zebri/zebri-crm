import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { VideoBlock } from '@/app/(dashboard)/branding/blocks/types'
import { RenderVideo } from '@/lib/branding/public-blocks/proposal/video'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const branding = buildPublicBranding({ business_name: 'Sam MC' })
const base: VideoBlock = { id: 'v', type: 'video', source: null, heading: '', caption: '' }

describe('RenderVideo', () => {
  it('renders null when there is no source', () => {
    const { container } = render(<RenderVideo block={base} branding={branding} frame="document" />)
    expect(container.firstChild).toBeNull()
  })

  it('an upload source renders a controlled video in page/document and only the poster in print', () => {
    const uploadBlock: VideoBlock = { ...base, source: { kind: 'upload', url: 'https://x/v.mp4', posterUrl: 'https://x/p.jpg' } }

    const { container: pageContainer } = render(<RenderVideo block={uploadBlock} branding={branding} frame="page" />)
    const video = pageContainer.querySelector('video')
    expect(video).not.toBeNull()
    expect(video?.hasAttribute('controls')).toBe(true)

    const { container: printContainer } = render(<RenderVideo block={uploadBlock} branding={branding} frame="print" />)
    expect(printContainer.querySelector('video')).toBeNull()
    expect(printContainer.querySelector('img')?.getAttribute('src')).toBe('https://x/p.jpg')
  })

  it('a YouTube embed URL renders a privacy-enhanced iframe', () => {
    const embedBlock: VideoBlock = { ...base, source: { kind: 'embed', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } }
    const { container } = render(<RenderVideo block={embedBlock} branding={branding} frame="document" />)
    const iframe = container.querySelector('iframe')
    expect(iframe?.getAttribute('src')).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\//)
  })

  it('a non-YouTube/Vimeo embed URL renders null', () => {
    const embedBlock: VideoBlock = { ...base, source: { kind: 'embed', url: 'https://example.com/clip' } }
    const { container } = render(<RenderVideo block={embedBlock} branding={branding} frame="document" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the heading only when it has content', () => {
    const uploadBlock: VideoBlock = { ...base, source: { kind: 'upload', url: 'https://x/v.mp4' } }
    const { container: noHeading } = render(<RenderVideo block={uploadBlock} branding={branding} frame="document" />)
    expect(noHeading.querySelector('h2')).toBeNull()

    const { container: withHeading, getByText } = render(
      <RenderVideo block={{ ...uploadBlock, heading: 'Our first look' }} branding={branding} frame="document" />,
    )
    expect(withHeading.querySelector('h2')).not.toBeNull()
    expect(getByText('Our first look')).toBeInTheDocument()
  })

  it('renders a slotted heading in a div, not h2 - a live editor field is multi-line and its own <p> markup is invalid inside a heading tag', () => {
    const uploadBlock: VideoBlock = { ...base, source: { kind: 'upload', url: 'https://x/v.mp4' } }
    const { container } = render(
      <RenderVideo block={uploadBlock} branding={branding} frame="document" slots={{ heading: <div data-testid="live-heading">editing</div> }} />,
    )
    expect(container.querySelector('h2')).toBeNull()
    expect(container.querySelector('[data-testid="live-heading"]')).not.toBeNull()
  })

  it('widthPx sizes just the media box, capped so it can never overflow a narrower column', () => {
    const uploadBlock: VideoBlock = { ...base, source: { kind: 'upload', url: 'https://x/v.mp4' }, widthPx: 480 }
    const { container } = render(<RenderVideo block={uploadBlock} branding={branding} frame="document" />)
    const wrapper = container.querySelector('video')?.parentElement?.parentElement as HTMLElement
    expect(wrapper.style.width).toBe('480px')
    expect(wrapper.style.maxWidth).toBe('100%')
    // The section's alignment decides where a narrower box sits, via the
    // `--doc-box-margin` variable the content column publishes
    // (`features/proposals/render/section-style.ts`); centred when unset.
    expect(wrapper.style.marginInline).toBe('var(--doc-box-margin, auto)')
  })

  it('cornerRadius overrides the brand radius on the media box; unset follows the brand', () => {
    const uploadBlock: VideoBlock = { ...base, source: { kind: 'upload', url: 'https://x/v.mp4' } }
    const { container: brand } = render(<RenderVideo block={uploadBlock} branding={branding} frame="document" />)
    expect((brand.querySelector('video')?.parentElement as HTMLElement).style.borderRadius).toBe(`${branding.corner_radius}px`)
    const { container: own } = render(<RenderVideo block={{ ...uploadBlock, cornerRadius: 24 }} branding={branding} frame="document" />)
    expect((own.querySelector('video')?.parentElement as HTMLElement).style.borderRadius).toBe('24px')
  })

  it('an unset widthPx keeps the media box at the column width (no inline width style)', () => {
    const uploadBlock: VideoBlock = { ...base, source: { kind: 'upload', url: 'https://x/v.mp4' } }
    const { container } = render(<RenderVideo block={uploadBlock} branding={branding} frame="document" />)
    const wrapper = container.querySelector('video')?.parentElement?.parentElement as HTMLElement
    expect(wrapper.getAttribute('style')).toBeNull()
  })
})
