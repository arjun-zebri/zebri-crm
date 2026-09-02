import { describe, expect, it } from 'vitest'

import { createScriptSchema, SCRIPT_CONTENT_MAX_BYTES, scriptContentSchema, updateScriptSchema } from '@/lib/documents/script-schemas'

describe('script schemas', () => {
  it('accepts a doc and rejects a non-doc root', () => {
    expect(scriptContentSchema.safeParse({ type: 'doc', content: [{ type: 'paragraph' }] }).success).toBe(true)
    expect(scriptContentSchema.safeParse({ type: 'paragraph' }).success).toBe(false)
  })

  it('rejects a document over the size cap', () => {
    const big = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(SCRIPT_CONTENT_MAX_BYTES) }] }] }
    expect(scriptContentSchema.safeParse(big).success).toBe(false)
  })

  it('requires at least one field on update and a valid font id', () => {
    expect(updateScriptSchema.safeParse({ id: '6f1e2a4c-1b2d-4c3e-9f8a-123456789abc' }).success).toBe(false)
    expect(updateScriptSchema.safeParse({ id: '6f1e2a4c-1b2d-4c3e-9f8a-123456789abc', font: 'noto_sans' }).success).toBe(true)
    expect(updateScriptSchema.safeParse({ id: '6f1e2a4c-1b2d-4c3e-9f8a-123456789abc', font: 'wingdings' }).success).toBe(false)
  })

  it('trims and bounds the title', () => {
    expect(createScriptSchema.safeParse({ couple_id: '6f1e2a4c-1b2d-4c3e-9f8a-123456789abc', title: '  Ceremony  ' }).data?.title).toBe('Ceremony')
    expect(createScriptSchema.safeParse({ couple_id: '6f1e2a4c-1b2d-4c3e-9f8a-123456789abc', title: 'x'.repeat(121) }).success).toBe(false)
  })
})
