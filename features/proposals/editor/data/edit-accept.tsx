'use client'

/**
 * Accept slot builder (Slice E1, UX audit 3.4): the button's label/colour
 * via {@link AcceptButtonPopover}. Structural edits (label, colour) commit
 * immediately - there is no debounced text stream for either, unlike a
 * typed field. No heading or reassurance field (2026-09-19 feedback:
 * "remove the text from all these sections... we can always add text
 * sections around them") - a heading or deposit/cancellation note is its
 * own text section stacked above/below; the section is the button alone.
 *
 * @module features/proposals/editor/data/edit-accept
 */
import type { AcceptSlots } from '@/lib/branding/public-blocks/proposal/accept'
import type { PublicBranding } from '@/lib/branding/public-branding'

import type { AcceptData } from '../../model/layout'

import { AcceptButtonPopover } from './accept-button-popover'
import type { EditSlotArgs } from './edit-slot-args'

/** Builds the accept block's `AcceptSlots`: the button's label/colour popover. */
export function acceptSlots({
  sectionId, data, dispatch, onFocus, branding, swatches,
}: EditSlotArgs<AcceptData> & { branding: PublicBranding; swatches: readonly string[] }): AcceptSlots {
  const patch = (next: Partial<AcceptData>, commit: boolean) => {
    dispatch({ type: 'setData', id: sectionId, data: { kind: 'accept', accept: { ...data, ...next } } }, { commit })
  }

  return {
    button: (
      <AcceptButtonPopover
        buttonLabel={data.buttonLabel}
        buttonColor={data.buttonColor}
        branding={branding}
        swatches={swatches}
        onFocus={onFocus}
        onChangeLabel={(buttonLabel) => patch({ buttonLabel }, true)}
        onChangeColor={(buttonColor) => patch({ buttonColor }, true)}
      />
    ),
  }
}
