// tests/unit/features/proposals/editor/testimonial-photo.test.tsx
/**
 * Slice E2 deliverable 4: a testimonial's portrait (UX audit 3.4). No
 * photo yet is a dashed "Add photo" button; a set photo gets a hover
 * Change/Remove, both routed through `useMediaUpload`.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { newSectionFor, TestimonialPhoto, uploadProposalMediaFile, type Section, type TestimonialsData } from '@/features/proposals'

vi.mock('@/features/proposals/data/media', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/proposals/data/media')>()
  return { ...actual, uploadProposalMediaFile: vi.fn() }
})

/** A `data.testimonials` slice with one item, off a fresh default section. */
function testimonialsData(): TestimonialsData {
  const data = (newSectionFor('testimonials').data as Extract<Section['data'], { kind: 'testimonials' }>).testimonials
  return { ...data, items: [{ id: 't1', quote: '', names: 'A & B' }] }
}

describe('TestimonialPhoto', () => {
  afterEach(() => vi.mocked(uploadProposalMediaFile).mockReset())

  it('an empty photo is a dashed "Add photo" button that uploads and commits', async () => {
    vi.mocked(uploadProposalMediaFile).mockResolvedValue('https://cdn.example/p.jpg')
    const dispatch = vi.fn()
    const data = testimonialsData()
    render(<TestimonialPhoto sectionId="s1" data={data} itemId="t1" imageUrl={undefined} dispatch={dispatch} onFocus={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add photo' }))
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'p.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(dispatch).toHaveBeenCalled())
    expect(dispatch).toHaveBeenCalledWith(
      {
        type: 'setData', id: 's1',
        data: { kind: 'testimonials', testimonials: { ...data, items: [{ ...data.items[0]!, imageUrl: 'https://cdn.example/p.jpg' }] } },
      },
      { commit: true },
    )
  })

  it('a set photo shows Change/Remove; Remove clears imageUrl and commits', () => {
    const dispatch = vi.fn()
    const data = testimonialsData()
    render(<TestimonialPhoto sectionId="s1" data={data} itemId="t1" imageUrl="https://cdn.example/p.jpg" dispatch={dispatch} onFocus={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }))
    expect(dispatch).toHaveBeenCalledTimes(1)
    const [action, opts] = dispatch.mock.calls[0]!
    expect(opts).toEqual({ commit: true })
    expect(action.data.testimonials.items[0]).not.toHaveProperty('imageUrl')
  })
})
