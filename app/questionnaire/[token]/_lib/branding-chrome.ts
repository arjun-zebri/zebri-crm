/**
 * Questionnaire branding chrome logic: splitting blocks around the form-style
 * marker (One at a time / All on one page) and deciding whether to show a
 * welcome screen in one-at-a-time mode.
 *
 * @module lib/questionnaires/branding-chrome
 */

import type { Block } from '@/app/(dashboard)/branding/blocks/types'

/**
 * Result of splitting and analyzing a questionnaire's branding blocks.
 *
 * - `preBlocks`: blocks to render before the questionnaire (above it in form mode,
 *   or as a welcome screen in typeform mode).
 * - `postBlocks`: blocks to render after the questionnaire (below it in form mode,
 *   or under the thank-you message in typeform mode).
 * - `showWelcome`: whether typeform mode should show a welcome screen before
 *   the first question (true only if pre-blocks contain more than a lone
 *   businessName block).
 * - `hasBusinessName`: whether the block tree contains a businessName block,
 *   used to decide if the legacy page header should render (only when false).
 */
export interface QuestionnaireChrome {
  preBlocks: Block[]
  postBlocks: Block[]
  showWelcome: boolean
  hasBusinessName: boolean
}

/**
 * Splits a questionnaire's branding blocks around the form-style marker
 * and decides whether to show a welcome screen in one-at-a-time mode.
 *
 * Back-compat: if blocks is empty or contains only the marker, this returns
 * empty pre/post, no welcome, no businessName. The legacy header then shows.
 *
 * Logic:
 * - If no marker, all blocks are pre-blocks; no post-blocks.
 * - If marker exists, split at it.
 * - Welcome screen (oneAtATime only): show if pre-blocks contain more than a
 *   lone businessName block. A lone businessName means the MC has only the
 *   marker and no additional intro, so no welcome screen is needed.
 * - businessName detection: any block with type 'businessName' in the tree.
 *
 * @param blocks The repaired branding_blocks from the questionnaire.
 * @param mode The questionnaire's display mode ('oneAtATime' or 'form').
 * @returns Chrome split and welcome-screen decision.
 */
export function questionnaireChrome(blocks: Block[], mode: 'oneAtATime' | 'form'): QuestionnaireChrome {
  // Find the marker. The form style is one of two marker blocks; if both are
  // present (an invalid, warned-about state), split at the first one — the same
  // first-in-tree tiebreak the page uses to pick the active renderer.
  const markerIdx = blocks.findIndex(
    (b) => b.type === 'questionnaireOneAtATime' || b.type === 'questionnaireAllOnePage',
  )

  // Split blocks around the marker.
  const preBlocks = markerIdx >= 0 ? blocks.slice(0, markerIdx) : blocks
  const postBlocks = markerIdx >= 0 ? blocks.slice(markerIdx + 1) : []

  // Detect if any block is a businessName.
  const hasBusinessName = blocks.some((b) => b.type === 'businessName')

  // Decide whether to show a welcome screen in one-at-a-time mode.
  // Only show if there are pre-blocks beyond a lone businessName.
  let showWelcome = false
  if (mode === 'oneAtATime' && preBlocks.length > 0) {
    // Count non-businessName pre-blocks.
    const nonBnPreBlocks = preBlocks.filter((b) => b.type !== 'businessName')
    showWelcome = nonBnPreBlocks.length > 0 || preBlocks.some((b) => b.type === 'businessName' && preBlocks.length > 1)
  }

  return { preBlocks, postBlocks, showWelcome, hasBusinessName }
}
