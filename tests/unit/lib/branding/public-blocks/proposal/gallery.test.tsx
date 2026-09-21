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

/** A minimal `GalleryBlock`. No heading/text fields (2026-09-19 feedback: "remove the text from all these sections"). */
function galleryBlock(overrides: Partial<GalleryBlock> = {}): GalleryBlock {
  return { id: 'g', type: 'gallery', images: [], layout: 'grid', ...overrides }
}

describe('RenderGallery', () => {
  it('renders null with no images and no trailing slot', () => {
    const { container } = render(<RenderGallery block={galleryBlock()} branding={branding} />)
    expect(container.firstChild).toBeNull()
  })

  it('grid layout renders one lazy-loaded image per photo', () => {
    const block = galleryBlock({ images })
    const { container } = render(<RenderGallery block={block} branding={branding} />)
    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(2)
    imgs.forEach((img) => expect(img.getAttribute('loading')).toBe('lazy'))
  })

  it('grid layout parks a partial row where the section alignment says (`--doc-box-justify`), at the start when unset', () => {
    const { container } = render(<RenderGallery block={galleryBlock({ images })} branding={branding} />)
    const grid = container.querySelector('.grid') as HTMLElement
    expect(grid.className).toContain('[justify-content:var(--doc-box-justify,start)]')
    expect(grid.className).toContain('grid-cols-[repeat(auto-fit,minmax(0,calc((100%-0.75rem)/2-0.02px)))]')
    expect(grid.className).toContain('@md/doc:grid-cols-[repeat(auto-fit,minmax(0,calc((100%-1.5rem)/3-0.02px)))]')
  })

  it('a set tileHeight overrides every tile\'s row height', () => {
    const block = galleryBlock({ images, tileHeight: 200 })
    const { container } = render(<RenderGallery block={block} branding={branding} />)
    container.querySelectorAll('img').forEach((img) => expect((img.parentElement as HTMLElement).style.height).toBe('200px'))
  })

  it('carousel layout shows one image with Previous/Next controls', () => {
    const block = galleryBlock({ images, layout: 'carousel' })
    render(<RenderGallery block={block} branding={branding} />)
    expect(screen.getByRole('img')).toHaveAttribute('src', images[0]?.url)
    expect(screen.getByRole('button', { name: 'Next photo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous photo' })).toBeInTheDocument()
  })

  it('carousel layout with no images shows no Previous/Next controls', () => {
    const block = galleryBlock({ layout: 'carousel' })
    render(<RenderGallery block={block} branding={branding} />)
    expect(screen.queryByRole('button', { name: 'Next photo' })).not.toBeInTheDocument()
  })

  it('carouselBackgroundColor/carouselIconColor override the arrow buttons (2026-09-19 feedback)', () => {
    const block = galleryBlock({ images, layout: 'carousel', carouselBackgroundColor: '#FF00AA', carouselIconColor: '#00FF00' })
    render(<RenderGallery block={block} branding={branding} />)
    const next = screen.getByRole('button', { name: 'Next photo' })
    expect(next.style.background).toBe('rgb(255, 0, 170)')
    expect(next.style.color).toBe('rgb(0, 255, 0)')
  })
})
