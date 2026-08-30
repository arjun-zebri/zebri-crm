/**
 * Well-formedness tests for the starter contract catalog.
 *
 * A mention id that doesn't match a known contract variable would render
 * as an empty/raw token in a signed legal document, so we assert every
 * mention across both starters points at a real `CONTRACT_VARIABLES`
 * entry. Also guards unique names, non-empty fields, and valid TipTap.
 */
import type { JSONContent } from '@tiptap/react'
import { describe, expect, it } from 'vitest'

import { CONTRACT_VARIABLES } from '@/lib/contracts/contract-variables'
import { STARTER_CONTRACTS, starterContractsByName } from '@/lib/contracts/starter-contracts'

const KNOWN_IDS = new Set(CONTRACT_VARIABLES.map((v) => v.id))

/** Collect every mention id from a TipTap doc. */
function mentionIds(node: JSONContent, out: string[] = []): string[] {
  if (node.type === 'mention' && node.attrs?.id) out.push(String(node.attrs.id))
  if (Array.isArray(node.content)) for (const c of node.content) mentionIds(c, out)
  return out
}

describe('STARTER_CONTRACTS', () => {
  it('ships the two agreed agreements', () => {
    const names = STARTER_CONTRACTS.map((c) => c.name)
    expect(names).toEqual(['Wedding Service Agreement', 'Deposit & Cancellation Terms'])
  })

  it('has unique names and non-empty fields with valid TipTap bodies', () => {
    const names = STARTER_CONTRACTS.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
    for (const c of STARTER_CONTRACTS) {
      expect(c.description.trim().length).toBeGreaterThan(0)
      expect(c.content.type).toBe('doc')
      expect((c.content.content ?? []).length).toBeGreaterThan(0)
    }
  })

  it('names no role of its own, so a DJ is not called an MC', () => {
    for (const c of STARTER_CONTRACTS) {
      expect(JSON.stringify(c.content), c.name).not.toMatch(/\bMC\b/)
    }
  })

  it('only references known contract variables', () => {
    for (const c of STARTER_CONTRACTS) {
      for (const id of mentionIds(c.content)) {
        expect(KNOWN_IDS, `${c.name} uses ${id}`).toContain(id)
      }
    }
  })
})

describe('starterContractsByName', () => {
  it('resolves requested names and ignores unknown ones', () => {
    const result = starterContractsByName(['Wedding Service Agreement', 'bogus'])
    expect(result.map((c) => c.name)).toEqual(['Wedding Service Agreement'])
  })
})
