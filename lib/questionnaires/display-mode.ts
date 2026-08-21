/**
 * Where a questionnaire's answer style comes from.
 *
 * The style (one question at a time vs all on one page) is a branding
 * decision, not a per-template one: the public fill page reads it from the
 * MC's questionnaire branding blocks. The `display_mode` columns on
 * `questionnaire_templates` and `couple_questionnaires` are legacy snapshots
 * and must not drive rendering, or a preview will disagree with what the
 * couple actually sees.
 *
 * @module lib/questionnaires/display-mode
 */

import type { QuestionnaireDisplayMode } from './question-schema'

/** The block types that mark the answer style on the questionnaire surface. */
type FormStyleBlockType = 'questionnaireOneAtATime' | 'questionnaireAllOnePage'

/** Minimal shape this helper needs from a branding block. */
interface BlockLike {
  type: string
}

/**
 * Find the block that marks the answer style, if the surface has one.
 *
 * Exported so callers that need the block itself (the fill page styles its
 * chrome from it) share one predicate with {@link displayModeFromBlocks}
 * rather than repeating the type test and drifting apart.
 *
 * @param blocks - the questionnaire surface's block tree
 */
export function findFormStyleBlock<T extends BlockLike>(
  blocks: readonly T[],
): (T & { type: FormStyleBlockType }) | undefined {
  return blocks.find(
    (b): b is T & { type: FormStyleBlockType } =>
      b.type === 'questionnaireOneAtATime' || b.type === 'questionnaireAllOnePage',
  )
}

/**
 * Derive the answer style from a questionnaire surface's branding blocks.
 *
 * Safe fallbacks for the invalid states the branding editor warns about: if
 * both markers are present the first in the tree wins, and if neither is
 * present we fall back to the classic all-on-one-page form so the couple
 * always has something to fill.
 *
 * @param blocks - the questionnaire surface's block tree
 * @returns `'typeform'` for one question at a time, `'form'` for all on one page
 */
export function displayModeFromBlocks(blocks: readonly BlockLike[]): QuestionnaireDisplayMode {
  return findFormStyleBlock(blocks)?.type === 'questionnaireOneAtATime' ? 'typeform' : 'form'
}

/** Human-readable label for the answer style, for MC-facing surfaces. */
export function displayModeLabel(mode: QuestionnaireDisplayMode): string {
  return mode === 'typeform' ? 'one at a time' : 'all on one page'
}
