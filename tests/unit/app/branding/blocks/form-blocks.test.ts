/**
 * Unit tests for the Website form (`lead`) surface block model: block types,
 * labels, palette membership, policy constraints, and defaults.
 *
 * @module tests/unit/app/branding/blocks/form-blocks
 */
import { describe, expect, it } from 'vitest'

import {
  blocksForSurface,
  DOC_SPECIFIC_BY_SURFACE,
} from '@/app/(dashboard)/branding/blocks/blocks-by-surface'
import { blockTemplate, defaultBlocksFor } from '@/app/(dashboard)/branding/blocks/defaults'
import { atLeastOneForSurface, exactlyOneForSurface } from '@/app/(dashboard)/branding/blocks/policy'
import { BLOCK_DESCRIPTIONS, BLOCK_LABELS } from '@/app/(dashboard)/branding/blocks/types'
import type { SurfaceTab } from '@/types/branding-preview'

describe('lead surface registration', () => {
  it('lead is a valid SurfaceTab', () => {
    const s: SurfaceTab = 'lead'
    expect(s).toBe('lead')
  })
})

describe('form block types', () => {
  it('have labels + descriptions', () => {
    expect(BLOCK_LABELS.formField).toBe('Form field')
    expect(BLOCK_LABELS.formSubmit).toBe('Submit button')
    expect(BLOCK_DESCRIPTIONS.formField).toContain('field')
    expect(BLOCK_DESCRIPTIONS.formSubmit).toContain('button')
  })
})

describe('lead palette + policy', () => {
  it('exposes general + form blocks', () => {
    expect(DOC_SPECIFIC_BY_SURFACE.lead).toEqual(['formField', 'formSubmit'])
    const all = blocksForSurface('lead')
    expect(all).toContain('formField')
    expect(all).toContain('formSubmit')
    expect(all).toContain('text') // a general block
  })

  it('requires exactly one submit and at least one field', () => {
    expect(exactlyOneForSurface('lead')).toEqual(['formSubmit'])
    expect(atLeastOneForSurface('lead')).toEqual(['formField'])
  })
})

describe('lead defaults + templates', () => {
  it('formField template defaults to a required name field', () => {
    const b = blockTemplate('formField', 'lead')
    expect(b.type).toBe('formField')
    if (b.type === 'formField') {
      expect(b.role).toBe('name')
      expect(b.required).toBe(true)
      expect(b.inputType).toBe('text')
    }
  })

  it('formSubmit template has button + success copy', () => {
    const b = blockTemplate('formSubmit')
    expect(b.type).toBe('formSubmit')
    if (b.type === 'formSubmit') {
      expect(b.label).toBe('Send enquiry')
      expect(b.successMessage.length).toBeGreaterThan(0)
    }
  })

  it('default lead form is valid: a name field, an email field, and a submit', () => {
    const blocks = defaultBlocksFor('lead')
    const roles = blocks.flatMap((b) => (b.type === 'formField' ? [b.role] : []))
    expect(roles).toContain('name')
    expect(roles).toContain('email')
    expect(blocks.some((b) => b.type === 'formSubmit')).toBe(true)
  })
})
