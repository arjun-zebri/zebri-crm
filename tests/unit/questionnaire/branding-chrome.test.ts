/**
 * Unit tests for questionnaire branding chrome logic.
 *
 * @module tests/unit/questionnaires/branding-chrome.test
 */

import { describe, it, expect } from 'vitest'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { questionnaireChrome } from '@/app/questionnaire/[token]/_lib/branding-chrome'

/** Helper to create a mock block of a given type. */
function mockBlock(type: Block['type'], id: string = type): Block {
  const base = { id, type, deleted: false } as unknown as Block
  return base
}

describe('questionnaireChrome', () => {
  describe('empty blocks', () => {
    it('returns empty pre/post, no welcome, no businessName', () => {
      const result = questionnaireChrome([], 'typeform')
      expect(result).toEqual({
        preBlocks: [],
        postBlocks: [],
        showWelcome: false,
        hasBusinessName: false,
      })
    })
  })

  describe('marker-only tree', () => {
    it('splits at the marker and returns empty pre/post', () => {
      const blocks: Block[] = [mockBlock('questionnaireBody')]
      const result = questionnaireChrome(blocks, 'form')
      expect(result).toEqual({
        preBlocks: [],
        postBlocks: [],
        showWelcome: false,
        hasBusinessName: false,
      })
    })
  })

  describe('no marker (legacy)', () => {
    it('returns all blocks as pre-blocks, empty post-blocks', () => {
      const blocks: Block[] = [mockBlock('text', 'text1'), mockBlock('text', 'text2')]
      const result = questionnaireChrome(blocks, 'form')
      expect(result.preBlocks).toEqual(blocks)
      expect(result.postBlocks).toEqual([])
    })
  })

  describe('lone businessName pre-block (no welcome)', () => {
    it('returns businessName as pre-block, no welcome in typeform', () => {
      const blocks: Block[] = [mockBlock('businessName'), mockBlock('questionnaireBody')]
      const result = questionnaireChrome(blocks, 'typeform')
      expect(result.preBlocks).toEqual([blocks[0]])
      expect(result.postBlocks).toEqual([])
      expect(result.showWelcome).toBe(false)
      expect(result.hasBusinessName).toBe(true)
    })
  })

  describe('pre-blocks with more than businessName (welcome in typeform)', () => {
    it('shows welcome in typeform when pre-blocks contain text + businessName', () => {
      const blocks: Block[] = [
        mockBlock('businessName'),
        mockBlock('text', 'intro'),
        mockBlock('questionnaireBody'),
      ]
      const result = questionnaireChrome(blocks, 'typeform')
      expect(result.preBlocks).toEqual([blocks[0], blocks[1]])
      expect(result.postBlocks).toEqual([])
      expect(result.showWelcome).toBe(true)
      expect(result.hasBusinessName).toBe(true)
    })

    it('shows welcome in typeform when pre-blocks contain multiple text blocks', () => {
      const blocks: Block[] = [
        mockBlock('text', 'intro1'),
        mockBlock('text', 'intro2'),
        mockBlock('questionnaireBody'),
      ]
      const result = questionnaireChrome(blocks, 'typeform')
      expect(result.preBlocks).toEqual([blocks[0], blocks[1]])
      expect(result.postBlocks).toEqual([])
      expect(result.showWelcome).toBe(true)
      expect(result.hasBusinessName).toBe(false)
    })

    it('does NOT show welcome in form mode, regardless of pre-blocks', () => {
      const blocks: Block[] = [
        mockBlock('text', 'intro1'),
        mockBlock('text', 'intro2'),
        mockBlock('questionnaireBody'),
      ]
      const result = questionnaireChrome(blocks, 'form')
      expect(result.preBlocks).toEqual([blocks[0], blocks[1]])
      expect(result.postBlocks).toEqual([])
      expect(result.showWelcome).toBe(false)
    })
  })

  describe('post-blocks', () => {
    it('returns post-blocks after the marker', () => {
      const blocks: Block[] = [
        mockBlock('text', 'intro'),
        mockBlock('questionnaireBody'),
        mockBlock('text', 'outro1'),
        mockBlock('text', 'outro2'),
      ]
      const result = questionnaireChrome(blocks, 'form')
      expect(result.preBlocks).toEqual([blocks[0]])
      expect(result.postBlocks).toEqual([blocks[2], blocks[3]])
    })
  })

  describe('businessName detection', () => {
    it('detects businessName in pre-blocks', () => {
      const blocks: Block[] = [mockBlock('businessName'), mockBlock('questionnaireBody')]
      const result = questionnaireChrome(blocks, 'form')
      expect(result.hasBusinessName).toBe(true)
    })

    it('detects businessName in post-blocks', () => {
      const blocks: Block[] = [mockBlock('questionnaireBody'), mockBlock('businessName')]
      const result = questionnaireChrome(blocks, 'form')
      expect(result.hasBusinessName).toBe(true)
    })

    it('returns false when no businessName block exists', () => {
      const blocks: Block[] = [mockBlock('text', 'text1'), mockBlock('questionnaireBody')]
      const result = questionnaireChrome(blocks, 'form')
      expect(result.hasBusinessName).toBe(false)
    })
  })

  describe('back-compat: questionnaire with no saved blocks', () => {
    it('renders exactly as legacy (empty tree => no chrome, legacy header shows)', () => {
      // Simulate repair seeding a marker-only tree.
      const blocks: Block[] = [mockBlock('questionnaireBody')]
      const result = questionnaireChrome(blocks, 'typeform')
      // No pre-blocks beyond marker → no welcome.
      expect(result.preBlocks).toEqual([])
      expect(result.postBlocks).toEqual([])
      expect(result.showWelcome).toBe(false)
      expect(result.hasBusinessName).toBe(false)
    })
  })
})
