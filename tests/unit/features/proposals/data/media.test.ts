// tests/unit/features/proposals/data/media.test.ts
/**
 * Task 8: `uploadProposalMediaFile`'s validation branch: a bad MIME type
 * or an oversized file is rejected with a readable message before any
 * session lookup or request opens. The XHR upload path itself mirrors
 * `app/(dashboard)/branding/upload-proposal-media.ts`, already covered by
 * `tests/unit/app/branding/upload-proposal-media.test.ts`; this file only
 * covers what's new here (validation against `MEDIA_LIMITS`, per kind).
 *
 * @module tests/unit/features/proposals/data/media
 */
import { describe, expect, it } from 'vitest'

import { MEDIA_LIMITS, uploadProposalMediaFile } from '@/features/proposals'

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
