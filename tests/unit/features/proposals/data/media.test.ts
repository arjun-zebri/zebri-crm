// tests/unit/features/proposals/data/media.test.ts
/**
 * Task 8: `uploadProposalMediaFile`'s validation branch: a bad MIME type
 * or an oversized file is rejected with a readable message before any
 * session lookup or request opens. The XHR upload path itself mirrors
 * `app/(dashboard)/branding/upload-proposal-media.ts`, already covered by
 * `tests/unit/app/branding/upload-proposal-media.test.ts`; this file only
 * covers what's new here (validation against `MEDIA_LIMITS`, per kind).
 *
 * Also covers `listProposalImages` (the Image insert chooser):
 * the session guard, the generic error on a failed Storage list, mapping
 * each listed object to its public URL, and filtering out a folder
 * placeholder's null-id entry.
 *
 * @module tests/unit/features/proposals/data/media
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { listProposalImages, MEDIA_LIMITS, uploadProposalMediaFile } from '@/features/proposals'

const getSession = vi.fn()
const list = vi.fn()
const getPublicUrl = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession },
    storage: { from: () => ({ list, getPublicUrl }) },
  }),
}))

/** A `File` reporting `sizeBytes` regardless of its real (tiny) content. */
function fileOf(name: string, type: string, sizeBytes: number): File {
  const file = new File([new Uint8Array(1)], name, { type })
  Object.defineProperty(file, 'size', { value: sizeBytes })
  return file
}

describe('MEDIA_LIMITS', () => {
  it('caps image at 10MB, audio at 25MB, and video/background at 50MB', () => {
    expect(MEDIA_LIMITS.image.maxBytes).toBe(10 * 1024 * 1024)
    expect(MEDIA_LIMITS.audio.maxBytes).toBe(25 * 1024 * 1024)
    expect(MEDIA_LIMITS.video.maxBytes).toBe(50 * 1024 * 1024)
    expect(MEDIA_LIMITS.background.maxBytes).toBe(50 * 1024 * 1024)
  })
})

describe('uploadProposalMediaFile validation', () => {
  it('rejects a file whose type is not in the kind\'s allowlist, before any network call', async () => {
    const file = fileOf('notes.txt', 'text/plain', 100)
    await expect(uploadProposalMediaFile(file, 'image')).rejects.toThrow(/type/i)
  })

  it('rejects an image over 10MB', async () => {
    const file = fileOf('big.png', 'image/png', MEDIA_LIMITS.image.maxBytes + 1)
    await expect(uploadProposalMediaFile(file, 'image')).rejects.toThrow(/10MB/)
  })

  it('rejects an audio file over 25MB', async () => {
    const file = fileOf('big.mp3', 'audio/mpeg', MEDIA_LIMITS.audio.maxBytes + 1)
    await expect(uploadProposalMediaFile(file, 'audio')).rejects.toThrow(/25MB/)
  })

  it('rejects a video file over 50MB', async () => {
    const file = fileOf('big.mp4', 'video/mp4', MEDIA_LIMITS.video.maxBytes + 1)
    await expect(uploadProposalMediaFile(file, 'video')).rejects.toThrow(/50MB/)
  })

  it('rejects a background (hero cover) file outside the video allowlist', async () => {
    const file = fileOf('cover.gif', 'image/gif', 100)
    await expect(uploadProposalMediaFile(file, 'background')).rejects.toThrow(/type/i)
  })
})

describe('listProposalImages', () => {
  afterEach(() => {
    getSession.mockReset()
    list.mockReset()
    getPublicUrl.mockReset()
  })

  it('rejects when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    await expect(listProposalImages()).rejects.toThrow(/signed in/i)
    expect(list).not.toHaveBeenCalled()
  })

  it('throws a generic message when the Storage list call errors', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    list.mockResolvedValue({ data: null, error: new Error('permission denied') })
    await expect(listProposalImages()).rejects.toThrow(/could not load/i)
  })

  it('lists the signed-in user\'s image folder, newest first, and maps each object to its public url', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    list.mockResolvedValue({
      data: [
        { id: '1', name: 'a.jpg', created_at: '2026-01-02T00:00:00Z' },
        { id: '2', name: 'b.jpg', created_at: '2026-01-01T00:00:00Z' },
      ],
      error: null,
    })
    getPublicUrl.mockImplementation((path: string) => ({ data: { publicUrl: `https://cdn.example/${path}` } }))

    const images = await listProposalImages()

    expect(list).toHaveBeenCalledWith('u1/image', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } })
    expect(images).toEqual([
      { url: 'https://cdn.example/u1/image/a.jpg', name: 'a.jpg', createdAt: '2026-01-02T00:00:00Z' },
      { url: 'https://cdn.example/u1/image/b.jpg', name: 'b.jpg', createdAt: '2026-01-01T00:00:00Z' },
    ])
  })

  it('filters out a folder placeholder entry (null id)', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    list.mockResolvedValue({ data: [{ id: null, name: '.emptyFolderPlaceholder', created_at: null }], error: null })
    getPublicUrl.mockReturnValue({ data: { publicUrl: 'unused' } })

    await expect(listProposalImages()).resolves.toEqual([])
  })
})
