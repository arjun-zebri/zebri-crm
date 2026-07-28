// eslint-disable-next-line no-restricted-imports
import type { TextStyle } from '@/app/(dashboard)/branding/blocks/types'

/**
 * Editable copy for the proposal surface.
 *
 * The proposal layout + section order are fixed (a block tree can't
 * express the option chooser), but the MC controls every visible
 * label: the eyebrows above each section, the two helper lines, and
 * the accept / decline wording. These are brand-level (one set per
 * MC, applied to every proposal), stored in `user_metadata`
 * (`proposal_labels`) and returned by `_user_branding` so the public
 * page, the composer preview, and the branding editor all read the
 * same values.
 *
 * Every field falls back to {@link PROPOSAL_LABEL_DEFAULTS}, so an MC
 * who never customises sees the standard wording and nothing can
 * render blank.
 *
 * @module lib/branding/proposal-labels
 */

/**
 * A proposal label with optional styling.
 *
 * The text field is always required; style is optional and merges
 * with the role's default text style when resolved for rendering.
 */
export interface StyledLabel {
  /** The displayed text. */
  text: string
  /** Optional style overrides. */
  style?: TextStyle
}

/** The editable labels on a proposal. Each label includes text and optional style. Keys mirror the page sections. */
export interface ProposalLabels {
  /** Small eyebrow above the couple's names. */
  eyebrow: StyledLabel
  /** Heading above the MC's personal note. */
  note: StyledLabel
  /** Heading above the package chooser (multi-option only). */
  choose: StyledLabel
  /** Helper line under the chooser heading. */
  chooseHint: StyledLabel
  /** Heading above the chosen option's inclusions. */
  selected: StyledLabel
  /** Heading above the optional add-on cards. */
  addOns: StyledLabel
  /** Helper line under the add-ons heading. */
  addOnsHint: StyledLabel
  /** The primary accept button. */
  accept: StyledLabel
  /** The quiet decline link. */
  decline: StyledLabel
}

/** Commit one edited label's text and optional style. Present only on the branding canvas; omitted everywhere the proposal renders read-only. */
export type ProposalLabelEdit = (key: keyof ProposalLabels, text: string, style?: TextStyle) => void

export const PROPOSAL_LABEL_DEFAULTS: ProposalLabels = {
  eyebrow: { text: 'Wedding proposal' },
  note: { text: 'A note from us' },
  choose: { text: 'Choose your package' },
  chooseHint: { text: 'Select the one that fits your day. Everything updates below.' },
  selected: { text: 'Your package' },
  addOns: { text: 'Add to your day' },
  addOnsHint: { text: 'Tap to include. Your total updates instantly.' },
  accept: { text: 'Accept' },
  decline: { text: 'Decline' },
}

/**
 * Resolve a partial/unknown labels object (e.g. from the JSONB payload)
 * into a complete {@link ProposalLabels}, filling blanks and missing
 * keys from the defaults. Accepts both the legacy string form
 * (`Record<key, string>`) and the new styled form (`Record<key, {text, style?}>`).
 * Whitespace-only text overrides fall back to the default too, so a
 * cleared field never renders empty.
 */
export function resolveProposalLabels(raw: unknown): ProposalLabels {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  const pick = (key: keyof ProposalLabels): StyledLabel => {
    const v = src[key]

    // Handle new styled form: {text, style?}
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const obj = v as Record<string, unknown>
      const text = typeof obj.text === 'string' && obj.text.trim() ? obj.text : PROPOSAL_LABEL_DEFAULTS[key].text
      const style = obj.style && typeof obj.style === 'object' ? (obj.style as TextStyle) : undefined
      const result: StyledLabel = { text }
      if (style) result.style = style
      return result
    }

    // Handle legacy string form
    if (typeof v === 'string' && v.trim()) {
      return { text: v }
    }

    // Fall back to default
    return { ...PROPOSAL_LABEL_DEFAULTS[key] }
  }

  return {
    eyebrow: pick('eyebrow'),
    note: pick('note'),
    choose: pick('choose'),
    chooseHint: pick('chooseHint'),
    selected: pick('selected'),
    addOns: pick('addOns'),
    addOnsHint: pick('addOnsHint'),
    accept: pick('accept'),
    decline: pick('decline'),
  }
}
