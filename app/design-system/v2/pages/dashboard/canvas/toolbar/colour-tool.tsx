'use client';

import type { CSSProperties, ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import { SwatchPicker, type Swatch } from '@/components/ui-v2/swatch-picker';

import { kitColours, kitHexOf, type BrandKit } from '../../brand/kit';
import { Dot } from '../../doc-builder/editor/section-bar/bar-parts';
import { refOf } from '../look';
import type { ColorRef } from '../model';
import { colorOf } from '../resolve';

/**
 * A colour button for the toolbar, as Canva has it: the brand kit's
 * colours first (picking one keeps the element linked to the kit, so a
 * kit change recolours it), then the colours already on this document,
 * then any colour at all. `glyph` is what the button shows (an "A" over a
 * bar for text, a dot for a fill: the doc builder bar's `Dot`, so "no
 * colour" is drawn one way everywhere).
 *
 * @module app/design-system/v2/pages/dashboard/canvas/toolbar/colour-tool
 */

export interface ColourToolProps {
  label: string;
  value: ColorRef | null | undefined;
  kit: BrandKit;
  /** Hexes used on the document, offered after the kit's. */
  used: string[];
  onChange: (ref: ColorRef) => void;
  /** Offers "No colour" (a shape's fill or outline). */
  onClear?: (() => void) | undefined;
  glyph: (hex: string | undefined) => ReactNode;
}

/** The colour button. See {@link ColourToolProps}. */
export function ColourTool({ label, value, kit, used, onChange, onClear, glyph }: ColourToolProps) {
  const hex = colorOf(value, kit);
  const kitSwatches: Swatch[] = kitColours(kit).map((c) => ({ value: c.hex, name: c.name }));
  const kitHexes = new Set(kitSwatches.map((s) => s.value.toLowerCase()));
  const docSwatches: Swatch[] = [...new Set(used.map((h) => h.toLowerCase()))].filter((h) => !kitHexes.has(h)).map((h) => ({ value: h, name: h.toUpperCase() }));
  const pick = (h: string) => onChange(refOf(h, kit));
  // With no colour set, the pickers show the kit's ink as the current one.
  const shown = hex ?? kitHexOf(kit, 'ink');
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" square aria-label={label}>
          {glyph(hex)}
        </Button>
      </PopoverTrigger>
      <PopoverContent size="card" align="start" className="space-y-4">
        <SwatchPicker label="Brand colours" swatches={kitSwatches} value={shown} onChange={pick} />
        {docSwatches.length ? <SwatchPicker label="On this document" swatches={docSwatches} value={shown} onChange={pick} /> : null}
        {onClear ? (
          <Button variant="secondary" icon={<Dot colour={null} />} onClick={onClear}>
            No colour
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** An "A" over a bar of `hex`: a text colour's button. */
export function LetterA({ hex }: { hex: string | undefined }) {
  return (
    <span className="flex flex-col items-center leading-none">
      <span className="type-label text-zebra-950">A</span>
      <span style={{ '--bar': hex ?? 'transparent' } as CSSProperties} className="mt-0.5 h-1 w-4 rounded-pill bg-[var(--bar)] ring-1 ring-inset ring-hairline" />
    </span>
  );
}
