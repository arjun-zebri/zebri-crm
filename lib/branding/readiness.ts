/**
 * Pure readiness engine for document blocks: Layer A (required/at-least-one/questionnaire-mode)
 * and Layer B (account prerequisites like stripe, bank details, contract template).
 *
 * This module contains NO React and NO IO. It evaluates a branding kit's surface
 * against a couple's account readiness and returns a structured result suitable for
 * "Not ready to send" messaging and send-gating.
 *
 * @module lib/branding/readiness
 */

// The block policy helpers + type definitions live under app/(dashboard)/branding/
// because they're consumed primarily by the editor surface there.
// This module is the one acceptable bridge that pulls them into a lib-level
// readiness evaluator. Layering exception noted in `.claude/docs/component-library.md`.
// eslint-disable-next-line no-restricted-imports
import {
  requiredTypesForSurface, atLeastOneForSurface,
} from '@/app/(dashboard)/branding/blocks/policy'
// eslint-disable-next-line no-restricted-imports
import type { Block, QuestionnaireBodyBlock } from '@/app/(dashboard)/branding/blocks/types'
// eslint-disable-next-line no-restricted-imports
import { BLOCK_LABELS } from '@/app/(dashboard)/branding/blocks/types'
import type { SurfaceTab } from '@/types/branding-preview'

/** Readiness state of the MC's account: which gating features are enabled or configured. */
export interface AccountReadiness {
  /** Stripe Connect is configured and ready for card payments. */
  stripeConnected: boolean
  /** Bank account details are filled in on the Settings page. */
  bankDetailsFilled: boolean
  /** Contract template exists and is ready to send. */
  contractTemplateExists: boolean
}

/** A single readiness issue blocking editing or sending. */
export interface ReadinessIssue {
  /** Category of issue: missing required block, at-least-one constraint, questionnaire mode, or account prerequisite. */
  kind: 'missing-required' | 'need-at-least-one' | 'questionnaire-mode' | 'account'
  /** Plain-language message (no block type codes, only human labels from BLOCK_LABELS). */
  message: string
}

/** Readiness result: whether a surface is ready to edit/send and what issues (if any) block it. */
export interface SurfaceReadiness {
  /** True when Layer A passes (all required blocks, constraints met). Layer B issues don't flip this. */
  ready: boolean
  /** All issues (Layer A + Layer B). Layer B issues use kind:'account' but never set ready:false. */
  issues: ReadinessIssue[]
}

/**
 * Evaluate a single surface for readiness: Layer A (required blocks, constraints)
 * and Layer B (account prerequisites).
 *
 * Layer A (sets `ready: false` when failed):
 * - All required block types for the surface must be present.
 * - Invoice: at least one of paymentDetails or action.
 * - Questionnaire: questionnaireBody must have a mode set.
 *
 * Layer B (produces `kind:'account'` issues but does NOT set `ready: false`):
 * - If paymentDetails block is present, account.bankDetailsFilled must be true.
 * - If action block is present on invoice, account.stripeConnected must be true.
 * - On contract surface, account.contractTemplateExists must be true.
 *
 * @param surface - The surface tab ('proposal', 'invoice', 'contract', 'portal', 'vendorTimeline', 'questionnaire').
 * @param blocks - The block tree for this surface.
 * @param account - The MC's account readiness state.
 * @returns { ready, issues } — Layer A readiness + all issues (Layer A + Layer B).
 */
export function evaluateSurface(
  surface: SurfaceTab,
  blocks: Block[],
  account: AccountReadiness,
): SurfaceReadiness {
  const issues: ReadinessIssue[] = []
  let layerAReady = true

  // Layer A: Required blocks
  const required = requiredTypesForSurface(surface)
  const blockTypes = new Set(blocks.map((b) => b.type))
  const missing = required.filter((type) => !blockTypes.has(type))

  if (missing.length > 0) {
    layerAReady = false
    // One issue per missing block, labelled with its human name, so the panel
    // can render them as a bulleted list of the blocks that are still needed.
    for (const type of missing) {
      issues.push({ kind: 'missing-required', message: BLOCK_LABELS[type] })
    }
  }

  // Layer A: At-least-one constraint (invoice only)
  const atLeastOne = atLeastOneForSurface(surface)
  if (atLeastOne !== null) {
    const hasAtLeastOne = atLeastOne.some((type) => blockTypes.has(type))
    if (!hasAtLeastOne) {
      layerAReady = false
      issues.push({
        kind: 'need-at-least-one',
        message: 'Payment details or a payment action',
      })
    }
  }

  // Layer A: Questionnaire mode
  if (surface === 'questionnaire') {
    const questionnaireBlock = blocks.find((b) => b.type === 'questionnaireBody') as QuestionnaireBodyBlock | undefined
    if (questionnaireBlock && !questionnaireBlock.mode) {
      layerAReady = false
      issues.push({
        kind: 'questionnaire-mode',
        message: 'A questionnaire mode',
      })
    }
  }

  // Layer B: Account prerequisites (do NOT set ready: false)

  // If paymentDetails block is present, require bankDetailsFilled.
  if (blockTypes.has('paymentDetails') && !account.bankDetailsFilled) {
    issues.push({
      kind: 'account',
      message: 'Bank details (add in Settings)',
    })
  }

  // If action block is present on invoice, require stripeConnected.
  if (surface === 'invoice' && blockTypes.has('action') && !account.stripeConnected) {
    issues.push({
      kind: 'account',
      message: 'Stripe connection for card payments',
    })
  }

  // On contract surface, require contractTemplateExists.
  if (surface === 'contract' && !account.contractTemplateExists) {
    issues.push({
      kind: 'account',
      message: 'A contract template',
    })
  }

  return {
    ready: layerAReady,
    issues,
  }
}
