import { describe, it, expect } from 'vitest'

/**
 * Test that legacy brand kits (with the old accentColor/mutedColor schema
 * and no headingColor/subheadingColor) apply coherently when normalized.
 *
 * This regression test ensures brand kits persisted before the
 * headingColor/subheadingColor rollout still work without corruption.
 */
describe('Legacy brand-kit fallbacks', () => {
  /**
   * normalizeLegacyKit applies fallback relationships:
   * - headingColor: kit.headingColor || kit.textColor || currentState
   * - subheadingColor: kit.subheadingColor || kit.mutedColor || currentState
   */
  const normalizeLegacyKit = (
    kit: any,
    currentState: any,
  ): { headingColor: string; subheadingColor: string } => {
    return {
      headingColor:
        kit.headingColor ||
        kit.textColor ||
        currentState.headingColor,
      subheadingColor:
        kit.subheadingColor ||
        kit.mutedColor ||
        currentState.subheadingColor,
    }
  }

  it('normalizes a legacy kit with textColor and mutedColor', () => {
    const legacyKit = {
      id: 'kit-old',
      name: 'Legacy Kit',
      brandColor: '#FF0000',
      // Old schema: textColor, mutedColor, NO headingColor/subheadingColor
      textColor: '#333333',
      mutedColor: '#666666',
      surfaceColor: '#FFFFFF',
      secondaryColor: '#CCCCCC',
      fontHeading: 'inter',
      fontBody: 'inter',
      fontWeight: 600,
      fontBodyWeight: 400,
      fontScale: 1,
      density: 'cozy',
      cornerRadius: 8,
      docPadding: 12,
      tagline: 'Test',
      logoUrl: '',
      faviconUrl: '',
      headerImageUrl: '',
      blocks: null,
    }

    const currentState = {
      headingColor: '#111827',
      subheadingColor: '#111827',
    }

    const result = normalizeLegacyKit(legacyKit, currentState)

    // headingColor should fall back to kit.textColor
    expect(result.headingColor).toBe('#333333')
    // subheadingColor should fall back to kit.mutedColor
    expect(result.subheadingColor).toBe('#666666')
  })

  it('falls back to current state when legacy kit lacks both old and new keys', () => {
    const minimalistLegacyKit = {
      id: 'kit-minimal',
      name: 'Minimal Legacy Kit',
      brandColor: '#FF0000',
      // This kit has neither the new keys nor the old fallback keys
      surfaceColor: '#FFFFFF',
      secondaryColor: '#CCCCCC',
      fontHeading: 'inter',
      fontBody: 'inter',
      fontWeight: 600,
      fontBodyWeight: 400,
      fontScale: 1,
      density: 'cozy',
      cornerRadius: 8,
      docPadding: 12,
      tagline: '',
      logoUrl: '',
      faviconUrl: '',
      headerImageUrl: '',
      blocks: null,
    }

    const currentState = {
      headingColor: '#222222',
      subheadingColor: '#444444',
    }

    const result = normalizeLegacyKit(minimalistLegacyKit, currentState)

    // Should preserve current state
    expect(result.headingColor).toBe('#222222')
    expect(result.subheadingColor).toBe('#444444')
  })

  it('prefers new keys over legacy fallbacks', () => {
    const transitionKit = {
      id: 'kit-transition',
      name: 'Transition Kit',
      brandColor: '#FF0000',
      // Has both old schema AND new schema (e.g., manually edited or part-upgraded)
      headingColor: '#1a1a1a',
      subheadingColor: '#3a3a3a',
      textColor: '#999999',
      mutedColor: '#bbbbbb',
      surfaceColor: '#FFFFFF',
      secondaryColor: '#CCCCCC',
      fontHeading: 'inter',
      fontBody: 'inter',
      fontWeight: 600,
      fontBodyWeight: 400,
      fontScale: 1,
      density: 'cozy',
      cornerRadius: 8,
      docPadding: 12,
      tagline: '',
      logoUrl: '',
      faviconUrl: '',
      headerImageUrl: '',
      blocks: null,
    }

    const currentState = {
      headingColor: '#111111',
      subheadingColor: '#222222',
    }

    const result = normalizeLegacyKit(transitionKit, currentState)

    // Should prefer the new keys over legacy fallbacks
    expect(result.headingColor).toBe('#1a1a1a')
    expect(result.subheadingColor).toBe('#3a3a3a')
  })

  it('defines non-undefined colors for every role when a legacy kit is applied', () => {
    const legacyKit = {
      id: 'kit-legacy',
      name: 'Old Brand Kit',
      brandColor: '#FF0000',
      textColor: '#444444',
      mutedColor: '#888888',
      surfaceColor: '#FFFFFF',
      secondaryColor: '#CCCCCC',
      fontHeading: 'inter',
      fontBody: 'inter',
      fontWeight: 600,
      fontBodyWeight: 400,
      fontScale: 1,
      density: 'roomy',
      cornerRadius: 12,
      docPadding: 16,
      tagline: 'Old tagline',
      logoUrl: '',
      faviconUrl: '',
      headerImageUrl: '',
      blocks: null,
    }

    const currentState = {
      headingColor: '#111827',
      subheadingColor: '#111827',
    }

    const result = normalizeLegacyKit(legacyKit, currentState)

    // Both colours must be defined (non-undefined, non-null) after normalization
    expect(result.headingColor).toBeDefined()
    expect(result.subheadingColor).toBeDefined()
    expect(typeof result.headingColor).toBe('string')
    expect(typeof result.subheadingColor).toBe('string')
    expect(result.headingColor.length).toBeGreaterThan(0)
    expect(result.subheadingColor.length).toBeGreaterThan(0)
  })
})
