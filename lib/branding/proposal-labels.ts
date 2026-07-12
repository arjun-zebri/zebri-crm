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

/** The editable strings on a proposal. Keys mirror the page sections. */
export interface ProposalLabels {
  /** Small eyebrow above the couple's names. */
  eyebrow: string
  /** Heading above the MC's personal note. */
  note: string
  /** Heading above the package chooser (multi-option only). */
  choose: string
  /** Helper line under the chooser heading. */
  chooseHint: string
  /** Heading above the chosen option's inclusions. */
  selected: string
  /** Heading above the optional add-on cards. */
  addOns: string
  /** Helper line under the add-ons heading. */
  addOnsHint: string
  /** The primary accept button. */
  accept: string
  /** The quiet decline link. */
  decline: string
}

/** Commit one edited label. Present only on the branding canvas;
 *  omitted everywhere the proposal renders read-only. */
export type ProposalLabelEdit = (key: keyof ProposalLabels, value: string) => void

export const PROPOSAL_LABEL_DEFAULTS: ProposalLabels = {
  eyebrow: 'Wedding proposal',
  note: 'A note from us',
  choose: 'Choose your package',
  chooseHint: 'Select the one that fits your day. Everything updates below.',
  selected: 'Your package',
  addOns: 'Add to your day',
  addOnsHint: 'Tap to include. Your total updates instantly.',
  accept: 'Accept & reserve our date',
  decline: 'Decline this proposal',
}

/**
 * Resolve a partial/unknown labels object (e.g. from the JSONB
 * payload) into a complete {@link ProposalLabels}, filling blanks +
 * missing keys from the defaults. Whitespace-only overrides fall back
 * too, so a cleared field never renders empty.
 */
export function resolveProposalLabels(raw: unknown): ProposalLabels {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const pick = (key: keyof ProposalLabels): string => {
    const v = src[key]
    return typeof v === 'string' && v.trim() ? v : PROPOSAL_LABEL_DEFAULTS[key]
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
