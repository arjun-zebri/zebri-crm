// tests/unit/features/proposals/editor/insert-media.test.tsx
/**
 * Final fix round, Findings 2+3 (`.superpowers/sdd/2026-09-16-proposal-layout-v2-phase2-template-editor/final-review.md`):
 * `InsertMediaHost` + `use-insert-media.ts`, the mechanism that makes
 * `INSERT_ITEMS`' `requestImage`/`requestAudio`/`requestEmbed` callbacks
 * (`insert-items.ts`) do something instead of being a silent no-op, and
 * makes sure the embed path never lands a bare `url: null` placeholder
 * (which broke every autosave on the template, per Finding 2).
 *
 * Wires one `ContentSectionEditor` up to one `InsertMediaHost` the same
 * way `template-editor-body.tsx` does: a ref, not a shared context.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NodeSelection } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/react'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ContentSectionEditor, doc, getEditor, InsertMediaHost, listProposalImages, MEDIA_LIMITS, paragraph, text,
  uploadProposalMediaFile, useInsertMedia, type InsertMediaHandle, defaultTheme,
} from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

vi.mock('@/features/proposals/data/media', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/proposals/data/media')>()
  return { ...actual, uploadProposalMediaFile: vi.fn(), listProposalImages: vi.fn() }
})

const SAMPLE_BRANDING = buildPublicBranding({ business_name: 'Sam MC' })
const SAMPLE_THEME = defaultTheme(SAMPLE_BRANDING)
// `MEDIA_LIMITS[kind].types` is a non-empty readonly tuple in practice;
// `noUncheckedIndexedAccess` still types a plain index as possibly
// `undefined`, so these are pinned once here instead of at every call site.
const IMAGE_MIME = MEDIA_LIMITS.image.types[0]!
const AUDIO_MIME = MEDIA_LIMITS.audio.types[0]!

/** Mounts one section editor plus the insert-media host, wired together exactly as `template-editor-body.tsx` does; the provider is for the image chooser's library query. */
function Harness({ sectionId }: { sectionId: string }) {
  const hostRef = useRef<InsertMediaHandle>(null)
  useInsertMedia({ hostRef })
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return (
    <QueryClientProvider client={client}>
      <ContentSectionEditor
        sectionId={sectionId}
        content={doc(paragraph(text('Hi')))}
        branding={SAMPLE_BRANDING}
        theme={SAMPLE_THEME}
        externalVersion={0}
        onChange={() => {}}
        onFocusSection={() => {}}
        onNodeSelect={() => {}}
      />
      <InsertMediaHost ref={hostRef} />
    </QueryClientProvider>
  )
}

async function waitForEditor(sectionId: string) {
  await waitFor(() => expect(getEditor(sectionId)).not.toBeNull())
  return getEditor(sectionId)!
}

/** The single `type`-named node in `editor`'s doc, or `undefined`. */
function findNode(editor: Editor, type: string): { pos: number; attrs: Record<string, unknown> } | undefined {
  let found: { pos: number; attrs: Record<string, unknown> } | undefined
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === type) found = { pos, attrs: node.attrs }
  })
  return found
}

describe('InsertMediaHost + useInsertMedia', () => {
  afterEach(() => {
    vi.mocked(uploadProposalMediaFile).mockReset()
    vi.mocked(listProposalImages).mockReset()
  })

  it('requestImage opens the "Add an image" chooser; Upload inserts the new image node, node-selected, and closes it', async () => {
    vi.mocked(listProposalImages).mockResolvedValue([])
    vi.mocked(uploadProposalMediaFile).mockResolvedValue('https://cdn.example/a.jpg')
    render(<Harness sectionId="im1" />)
    const editor = await waitForEditor('im1')

    act(() => {
      editor.storage.proposalEditor.callbacks.requestImage?.()
    })
    expect(await screen.findByRole('dialog', { name: 'Add an image' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Upload image' }))
    // The chooser's own input, not the host's audio one: the modal is
    // portalled outside `container`, so query from the dialog itself.
    const input = screen.getByRole('dialog', { name: 'Add an image' }).querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'photo.jpg', { type: IMAGE_MIME })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(findNode(editor, 'image')).toBeDefined())
    const image = findNode(editor, 'image')!
    expect(image.attrs.src).toBe('https://cdn.example/a.jpg')
    expect(image.attrs.layout).toBe('inline')
    expect(image.attrs.widthPct).toBe(100)
    expect(editor.state.selection).toBeInstanceOf(NodeSelection)
    expect((editor.state.selection as NodeSelection).from).toBe(image.pos)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add an image' })).toBeNull())
  })

  it('clicking a library thumbnail in the chooser inserts that image without an upload', async () => {
    vi.mocked(listProposalImages).mockResolvedValue([{ url: 'https://cdn.example/sunset.jpg', name: 'sunset.jpg', createdAt: '' }])
    render(<Harness sectionId="im3" />)
    const editor = await waitForEditor('im3')

    act(() => {
      editor.storage.proposalEditor.callbacks.requestImage?.()
    })
    const thumb = await screen.findByRole('button', { name: 'Insert sunset.jpg' })
    await act(async () => {
      fireEvent.click(thumb)
    })

    expect(findNode(editor, 'image')?.attrs.src).toBe('https://cdn.example/sunset.jpg')
    expect(uploadProposalMediaFile).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Add an image' })).toBeNull()
  })

  it('uploads and inserts a new audio node, titled from the file name, node-selected, on requestAudio', async () => {
    vi.mocked(uploadProposalMediaFile).mockResolvedValue('https://cdn.example/track.mp3')
    const { container } = render(<Harness sectionId="au1" />)
    const editor = await waitForEditor('au1')

    act(() => {
      editor.storage.proposalEditor.callbacks.requestAudio?.()
    })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'processional.mp3', { type: AUDIO_MIME })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(findNode(editor, 'audio')).toBeDefined())
    const audio = findNode(editor, 'audio')!
    expect(audio.attrs.src).toBe('https://cdn.example/track.mp3')
    expect(audio.attrs.title).toBe('processional')
    expect(editor.state.selection).toBeInstanceOf(NodeSelection)
    expect((editor.state.selection as NodeSelection).from).toBe(audio.pos)
  })

  it('shows an inline error with Dismiss when the upload fails, and Dismiss clears it', async () => {
    vi.mocked(uploadProposalMediaFile).mockRejectedValue(new Error('Upload failed: network error'))
    render(<Harness sectionId="im2" />)
    const editor = await waitForEditor('im2')

    vi.mocked(listProposalImages).mockResolvedValue([])
    act(() => {
      editor.storage.proposalEditor.callbacks.requestImage?.()
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Upload image' }))
    const input = screen.getByRole('dialog', { name: 'Add an image' }).querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.jpg', { type: IMAGE_MIME })] } })

    expect(await screen.findByText('Upload failed: network error')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('Upload failed: network error')).toBeNull()
    // No half-inserted node from the failed upload.
    expect(findNode(editor, 'image')).toBeUndefined()
  })

  it('requestEmbed opens the "Embed a video" modal; a disallowed host shows an error and inserts nothing', async () => {
    render(<Harness sectionId="em1" />)
    const editor = await waitForEditor('em1')

    act(() => {
      editor.storage.proposalEditor.callbacks.requestEmbed?.()
    })
    expect(screen.getByRole('dialog', { name: 'Embed a video' })).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'Embed link' }), { target: { value: 'https://evil.example/x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }))

    expect(screen.getByText('That site cannot be embedded')).toBeInTheDocument()
    expect(findNode(editor, 'embed')).toBeUndefined()
  })

  it('requestEmbed inserts an embed node, node-selected, for an allowlisted url', async () => {
    render(<Harness sectionId="em2" />)
    const editor = await waitForEditor('em2')

    act(() => {
      editor.storage.proposalEditor.callbacks.requestEmbed?.()
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Embed link' }), { target: { value: 'https://youtu.be/abc123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }))

    const embed = findNode(editor, 'embed')
    expect(embed?.attrs.url).toBe('https://youtu.be/abc123')
    expect(editor.state.selection).toBeInstanceOf(NodeSelection)
    expect((editor.state.selection as NodeSelection).from).toBe(embed?.pos)
    // The modal closes on a successful insert.
    expect(screen.queryByRole('dialog', { name: 'Embed a video' })).toBeNull()
  })
})
