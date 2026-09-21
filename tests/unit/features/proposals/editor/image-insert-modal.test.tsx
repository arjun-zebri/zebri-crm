// tests/unit/features/proposals/editor/image-insert-modal.test.tsx
/**
 * `ImageInsertModal`, the "Add an image" chooser the Image insert item
 * opens: Loading / ErrorState (with retry) / Empty / the thumbnail grid,
 * and that a successful Upload refetches the library. The insert paths
 * themselves (thumbnail click, upload-then-insert) are covered end to end
 * through `InsertMediaHost` in `insert-media.test.tsx`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Editor } from '@tiptap/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildRichDocExtensions, doc, ImageInsertModal, listProposalImages, paragraph, uploadProposalMediaFile,
  type ProposalImage,
} from '@/features/proposals'

vi.mock('@/features/proposals/data/media', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/proposals/data/media')>()
  return { ...actual, listProposalImages: vi.fn(), uploadProposalMediaFile: vi.fn() }
})

function makeImage(name: string): ProposalImage {
  return { url: `https://cdn.example/${name}`, name, createdAt: '2026-01-01T00:00:00Z' }
}

function renderModal(editor: Editor | null, onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ImageInsertModal editor={editor} onClose={onClose} />
    </QueryClientProvider>,
  )
}

describe('ImageInsertModal', () => {
  afterEach(() => {
    vi.mocked(listProposalImages).mockReset()
    vi.mocked(uploadProposalMediaFile).mockReset()
  })

  it('renders nothing, and never lists the bucket, while closed', () => {
    renderModal(null)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(listProposalImages).not.toHaveBeenCalled()
  })

  it('shows Loading, then one thumbnail button per image', async () => {
    let resolve!: (images: ProposalImage[]) => void
    vi.mocked(listProposalImages).mockReturnValue(new Promise((r) => { resolve = r }))
    const editor = new Editor({ extensions: buildRichDocExtensions({}), content: doc(paragraph()) })
    renderModal(editor)

    expect(screen.getByRole('status', { name: 'Loading images' })).toBeInTheDocument()
    resolve([makeImage('a.jpg'), makeImage('b.jpg'), makeImage('c.jpg')])
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    expect(screen.getAllByRole('button', { name: /^Insert / })).toHaveLength(3)
    editor.destroy()
  })

  it('shows the empty state when the account has no uploaded images', async () => {
    vi.mocked(listProposalImages).mockResolvedValue([])
    const editor = new Editor({ extensions: buildRichDocExtensions({}), content: doc(paragraph()) })
    renderModal(editor)
    expect(await screen.findByText('No images yet')).toBeInTheDocument()
    editor.destroy()
  })

  it('shows an error state with a retry that reloads the list', async () => {
    vi.mocked(listProposalImages).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([makeImage('a.jpg')])
    const editor = new Editor({ extensions: buildRichDocExtensions({}), content: doc(paragraph()) })
    renderModal(editor)

    expect(await screen.findByText("Couldn't load images")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('button', { name: 'Insert a.jpg' })).toBeInTheDocument()
    editor.destroy()
  })

  it('Upload sends the file through uploadProposalMediaFile and refetches the library', async () => {
    vi.mocked(listProposalImages).mockResolvedValueOnce([]).mockResolvedValueOnce([makeImage('fresh.jpg')])
    vi.mocked(uploadProposalMediaFile).mockResolvedValue('https://cdn.example/fresh.jpg')
    const editor = new Editor({ extensions: buildRichDocExtensions({}), content: doc(paragraph()) })
    const onClose = vi.fn()
    renderModal(editor, onClose)
    await screen.findByText('No images yet')

    fireEvent.click(screen.getByRole('button', { name: 'Upload image' }))
    const input = screen.getByRole('dialog').querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'fresh.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(uploadProposalMediaFile).toHaveBeenCalledWith(file, 'image', expect.any(Function)))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(listProposalImages).toHaveBeenCalledTimes(2)
    editor.destroy()
  })
})
