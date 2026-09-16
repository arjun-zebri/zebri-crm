import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { VideoBlock } from '@/app/(dashboard)/branding/blocks/types'
import { RenderVideo } from '@/lib/branding/public-blocks/proposal/video'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const branding = buildPublicBranding({ business_name: 'Sam MC' })
const base: VideoBlock = { id: 'v', type: 'video', source: null, caption: '' }

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
})
