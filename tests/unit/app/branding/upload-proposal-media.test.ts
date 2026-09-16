/**
 * Unit tests for {@link uploadProposalMedia}: type/size validation, and the
 * XHR upload path (progress reporting + public URL), against a stubbed
 * `XMLHttpRequest` and a mocked Supabase client.
 *
 * @module tests/unit/app/branding/upload-proposal-media
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://s'
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= 'anon-key'

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { user: { id: 'u1' }, access_token: 't' } } }),
    },
    storage: {
      from: () => ({
        getPublicUrl: () => ({ data: { publicUrl: 'https://s/proposal-media/u1/k.mp4' } }),
      }),
    },
  }),
}))

/**
 * A minimal XHR stand-in: records what it was asked to send, then plays
 * back one progress event and a configurable final status on `send()`.
 * `uploadProposalMedia` is the only thing that talks to it, so it only
 * needs to support the calls that function makes.
 */
class FakeXHR {
  static instances: FakeXHR[] = []
  method = ''
  url = ''
  status = 0
  statusText = ''
  responseText = ''
  headers: Record<string, string> = {}
  upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = {
    onprogress: null,
  }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor() {
    FakeXHR.instances.push(this)
  }
  open(method: string, url: string) {
    this.method = method
    this.url = url
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value
  }
  send() {
    this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 })
    this.status = 200
    this.onload?.()
  }
}

beforeEach(() => {
  FakeXHR.instances = []
  vi.stubGlobal('XMLHttpRequest', FakeXHR)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('uploadProposalMedia', () => {
  it('rejects a non-video file and never opens a request', async () => {
    const { uploadProposalMedia } = await import('@/app/(dashboard)/branding/upload-proposal-media')
    const onError = vi.fn()
    const file = new File(['x'], 'notes.txt', { type: 'text/plain' })
    await expect(uploadProposalMedia(file, 'k.mp4', { onError })).rejects.toThrow()
    expect(onError).toHaveBeenCalledWith('Please choose an MP4 or WebM video')
    expect(FakeXHR.instances).toHaveLength(0)
  })

  it('rejects a file over 50MB', async () => {
    const { uploadProposalMedia, PROPOSAL_MEDIA_MAX_BYTES } = await import(
      '@/app/(dashboard)/branding/upload-proposal-media'
    )
    const onError = vi.fn()
    const big = new File([new Uint8Array(1)], 'big.mp4', { type: 'video/mp4' })
    Object.defineProperty(big, 'size', { value: PROPOSAL_MEDIA_MAX_BYTES + 1024 * 1024 })
    await expect(uploadProposalMedia(big, 'k.mp4', { onError })).rejects.toThrow()
    expect(onError).toHaveBeenCalledWith('Video must be under 50MB')
    expect(FakeXHR.instances).toHaveLength(0)
  })

  it('uploads a valid video, reports progress, and resolves a public URL', async () => {
    const { uploadProposalMedia } = await import('@/app/(dashboard)/branding/upload-proposal-media')
    const onProgress = vi.fn()
    const file = new File([new Uint8Array(10)], 'clip.mp4', { type: 'video/mp4' })
    const url = await uploadProposalMedia(file, 'k.mp4', { onProgress })

    expect(FakeXHR.instances).toHaveLength(1)
    const xhr = FakeXHR.instances[0]!
    expect(xhr.method).toBe('POST')
    expect(xhr.url).toBe('https://s/storage/v1/object/proposal-media/u1/k.mp4')
    expect(xhr.headers['x-upsert']).toBe('true')
    expect(onProgress).toHaveBeenCalledWith(50)
    expect(url.startsWith('https://s/proposal-media/u1/k.mp4')).toBe(true)
    expect(url).toContain('?t=')
  })
})
