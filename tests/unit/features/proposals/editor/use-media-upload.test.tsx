// tests/unit/features/proposals/editor/use-media-upload.test.tsx
/**
 * Slice E2: `useMediaUpload`, the shared upload picker gallery/video/
 * testimonial-photo all build on (mirrors `insert-media.test.tsx`'s
 * coverage of the always-mounted `InsertMediaHost`, but this hook is a
 * fresh instance per caller rather than one host mounted once).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { uploadProposalMediaFile, useMediaUpload } from '@/features/proposals'

vi.mock('@/features/proposals/data/media', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/proposals/data/media')>()
  return { ...actual, uploadProposalMediaFile: vi.fn() }
})

/** Mounts the hook behind one "Pick" button, matching how a caller (`AddPhotosTile`, `VideoMediaSlot`, `TestimonialPhoto`) wires it up. */
function Harness({ onDone, multiple }: { onDone: (urls: string[]) => void; multiple?: boolean }) {
  const { pick, input } = useMediaUpload()
  return (
    <>
      <button type="button" onClick={() => pick('image', multiple ? { multiple: true } : undefined, onDone)}>Pick</button>
      {input}
    </>
  )
}

describe('useMediaUpload', () => {
  afterEach(() => vi.mocked(uploadProposalMediaFile).mockReset())

  it('uploads one picked file and calls onDone with its url', async () => {
    vi.mocked(uploadProposalMediaFile).mockResolvedValue('https://cdn.example/a.jpg')
    const onDone = vi.fn()
    const { container } = render(<Harness onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick' }))
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(['https://cdn.example/a.jpg']))
  })

  it('still uploads when the input is reset before the files are read (a real FileList is live)', async () => {
    // In a browser `input.files` is a live FileList that empties the moment
    // `input.value = ''` runs; reading it after the reset uploads nothing
    // (live check: "Add photos" picked two files and showed no images,
    // no error). jsdom's static array hid that, so this test wires a
    // list that behaves like the real one.
    vi.mocked(uploadProposalMediaFile).mockResolvedValue('https://cdn.example/a.jpg')
    const onDone = vi.fn()
    const { container } = render(<Harness onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick' }))
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
    const live: File[] = [file]
    Object.defineProperty(input, 'files', { configurable: true, get: () => live })
    Object.defineProperty(input, 'value', { configurable: true, get: () => '', set: () => { live.length = 0 } })
    fireEvent.change(input)
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(['https://cdn.example/a.jpg']))
  })

  it('uploads every picked file, in order, when multiple is set', async () => {
    vi.mocked(uploadProposalMediaFile).mockResolvedValueOnce('https://cdn.example/a.jpg').mockResolvedValueOnce('https://cdn.example/b.jpg')
    const onDone = vi.fn()
    const { container } = render(<Harness onDone={onDone} multiple />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick' }))
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' }), new File(['y'], 'b.jpg', { type: 'image/jpeg' })] },
    })
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg']))
  })

  it('shows an error pill with Dismiss when the upload fails', async () => {
    vi.mocked(uploadProposalMediaFile).mockRejectedValue(new Error('Upload failed: network error'))
    const { container } = render(<Harness onDone={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick' }))
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } })
    expect(await screen.findByText('Upload failed: network error')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('Upload failed: network error')).toBeNull()
  })
})
