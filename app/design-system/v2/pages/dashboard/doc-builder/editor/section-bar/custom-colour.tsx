'use client';

import { useRef } from 'react';

import { ColorPopover } from '@/components/ui/color-popover';
import { MENU_ITEM } from '@/components/ui-v2/control-styles';
import { CheckIcon } from '@/components/ui-v2/icons';

import { Dot } from './bar-parts';

/**
 * Background's Custom colour row: it opens the app's full colour picker
 * (square, hue, hex, eyedropper) beside the list, with the brand's
 * colours as quick picks. The section follows the picker live; the
 * colour it closes on is one undo step.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/section-bar/custom-colour
 */

export interface CustomColourProps {
  /** The section's own colour when it is not one of the named ones, else null. */
  value: string | null;
  /** Where the picker starts when there is none yet. */
  start: string;
  swatches: readonly string[];
  /** A colour while picking (`commit` false), then the last one once, as the picker closes. */
  onPick: (hex: string, commit: boolean) => void;
}

/** The row and its picker. See {@link CustomColourProps}. */
export function CustomColour({ value, start, swatches, onPick }: CustomColourProps) {
  const last = useRef<string | null>(null);
  return (
    <ColorPopover
      value={value ?? start}
      swatches={swatches}
      // Above the Background list it opens from.
      zClassName="z-[80]"
      align="start"
      onChange={(hex) => {
        last.current = hex;
        onPick(hex, false);
      }}
      onOpenChange={(open) => {
        if (open) last.current = null;
        else if (last.current) onPick(last.current, true);
      }}
      trigger={
        <button type="button" role="menuitemradio" aria-checked={value !== null} className={`${MENU_ITEM}${value ? ' text-zebra-950' : ''}`}>
          <span className="mr-2.5 flex">
            {/* A colour wheel until a colour is picked: "any colour". */}
            {value ? <Dot colour={value} /> : <span aria-hidden="true" className="size-4 shrink-0 rounded-pill bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)]" />}
          </span>
          Custom colour
          {value ? <CheckIcon aria-hidden="true" className="ml-auto size-4 shrink-0 text-grass-700" /> : null}
        </button>
      }
    />
  );
}
