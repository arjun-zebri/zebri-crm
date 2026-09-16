import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { GalleryBlock } from '@/app/(dashboard)/branding/blocks/types'
import { RenderGallery } from '@/lib/branding/public-blocks/proposal/gallery'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const branding = buildPublicBranding({ business_name: 'Sam MC' })
const images = [
  { id: '1', url: 'https://x/1.jpg', alt: 'One' },
  { id: '2', url: 'https://x/2.jpg', alt: 'Two' },
]

describe('RenderGallery', () => {
  it('renders null with no images', () => {
    const block: GalleryBlock = { id: 'g', type: 'gallery', images: [], layout: 'grid' }
    const { container } = render(<RenderGallery block={block} branding={branding} />)
    expect(container.firstChild).toBeNull()
  })

  it('grid layout renders one lazy-loaded image per photo', () => {
    const block: GalleryBlock = { id: 'g', type: 'gallery', images, layout: 'grid' }
    const { container } = render(<RenderGallery block={block} branding={branding} />)
    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(2)
    imgs.forEach((img) => expect(img.getAttribute('loading')).toBe('lazy'))
  })

  it('carousel layout shows one image with Previous/Next controls', () => {
    const block: GalleryBlock = { id: 'g', type: 'gallery', images, layout: 'carousel' }
    render(<RenderGallery block={block} branding={branding} />)
    expect(screen.getByRole('img')).toHaveAttribute('src', images[0]?.url)
    expect(screen.getByRole('button', { name: 'Next photo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous photo' })).toBeInTheDocument()
  })
})
