'use client';

import type { Editor } from '@tiptap/react';
import { useState, type CSSProperties } from 'react';

import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import type { ProposalTheme, TextState } from '@/features/proposals';
import type { PublicBranding } from '@/lib/branding/public-branding';

import { BRAND_COLOUR, BRAND_DEEP } from '../../look/brand-vars';
import { BarButton, Dot } from '../section-bar/bar-parts';

/**
 * Text colour, as a short list of the brand's colours by name, the way
 * the section's Background is chosen (founder, 2026-10-10: "too many
 * colour pickers, it's not clear what is what"). Automatic puts the
 * words back to their style's colour. The brand colours are the live
 * variables, so the words follow a Brand kit change.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/text-bar/colour-menu
 */

/** `hex` darkened as `BRAND_DEEP` darkens the brand. */
const deepen = (hex: string) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.55).toString(16).padStart(2, '0')).join('')}`;

/** The colours on offer: what is written, what it looks like now, and its name; each look once. */
function choicesOf(branding: PublicBranding) {
  const all = [
    { value: BRAND_COLOUR, hex: branding.brand_color, label: 'Brand colour' },
    { value: BRAND_DEEP, hex: deepen(branding.brand_color), label: 'Brand colour, darker' },
    { value: branding.secondary_color, hex: branding.secondary_color, label: 'Second colour' },
    { value: '#ffffff', hex: '#ffffff', label: 'White' },
  ];
  return all.filter((c, i) => c.hex && all.findIndex((o) => o.hex.toLowerCase() === c.hex.toLowerCase()) === i);
}

/** The colour button and its list, for the selection in `editor`. */
export function ColourMenu({ editor, state, branding, theme }: { editor: Editor; state: TextState; branding: PublicBranding; theme: ProposalTheme }) {
  const [open, setOpen] = useState(false);
  // What Automatic looks like here: the style's own colour from the brand kit.
  const own = theme.text[state.style].color;
  const choices = choicesOf(branding);
  const current = state.color?.toLowerCase() ?? null;
  const pick = (colour: string | null) => {
    const chain = editor.chain().focus();
    (colour ? chain.setColor(colour) : chain.unsetColor()).run();
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <BarButton label="Text colour" on={open} toggle={false}>
          <span className="flex flex-col items-center">
            <span aria-hidden="true" className="type-label leading-none text-zebra-950">A</span>
            <span
              aria-hidden="true"
              // The words' colour now, known at runtime.
              style={{ '--bar': choices.find((c) => c.value.toLowerCase() === current)?.hex ?? state.color ?? own } as CSSProperties}
              className="mt-0.5 h-1 w-4 rounded-pill bg-[var(--bar)] ring-1 ring-inset ring-hairline"
            />
          </span>
        </BarButton>
      </PopoverTrigger>
      <PopoverContent data-text-bar="" size="menu" side="bottom" align="start" aria-label="Text colour">
        <MenuOption selected={current === null} onSelect={() => pick(null)}>
          <span className="mr-2.5 flex"><Dot colour={own} /></span>
          Automatic
        </MenuOption>
        {choices.map((c) => (
          <MenuOption key={c.value} selected={current === c.value.toLowerCase()} onSelect={() => pick(c.value)}>
            <span className="mr-2.5 flex"><Dot colour={c.hex} /></span>
            {c.label}
          </MenuOption>
        ))}
      </PopoverContent>
    </Popover>
  );
}
