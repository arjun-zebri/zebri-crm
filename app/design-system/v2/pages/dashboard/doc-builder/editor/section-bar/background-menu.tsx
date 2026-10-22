'use client';

import { useState } from 'react';

import { PhotosIcon } from '@/components/ui-v2/icons';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import type { Section } from '@/features/proposals';
import { getTextColor } from '@/lib/branding/contrast';

import { BRAND_COLOUR } from '../../look/brand-vars';
import { PhotoGrid, usePhotos } from '../photos';
import { useSectionEdit, type SettingsProps } from '../settings/row';

import { BarMenuButton, Dot } from './bar-parts';
import { CustomColour } from './custom-colour';

/**
 * One Background button on the bar, showing the colour in use, that
 * opens three choices (founder, 2026-10-10: "it should all be brand,
 * custom colour and photo"): Brand colour, Custom colour (the full
 * picker, with the brand's colours and white as quick picks) and Photo
 * from the brand kit. Picking the one already in use again clears it,
 * back to no background. Picking one also sets the text to read on it
 * (white on a dark colour or a photo, the brand's own on a light one), so
 * there is no text colour to choose. Brand colour is the live variable
 * the starters write, so it follows a Brand kit change.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/section-bar/background-menu
 */

type Background = NonNullable<Section['style']['background']>;

/** The Background button and its list, for `section`. */
export function BackgroundMenu({ builder, section }: SettingsProps) {
  const edit = useSectionEdit(builder, section);
  const photos = usePhotos();
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const bg: Background = section.style.background ?? {};
  const brand = builder.branding.brand_color;
  const current = bg.image ? 'photo' : bg.color === BRAND_COLOUR ? 'brand' : bg.color ? 'custom' : null;
  // One step: the background, and the text colour that reads on it.
  const set = (background: Background | undefined, textColor: string | undefined) => {
    edit.style({ background, textColor }, { commit: true });
    setOpen(false);
  };
  const readOn = (hex: string) => (getTextColor(hex) === '#ffffff' ? '#ffffff' : undefined);
  // The one in use, picked again, clears it.
  const toggle = (on: boolean, background: Background, textColor: string | undefined) => (on ? set(undefined, undefined) : set(background, textColor));
  // The section's own colour, when it is not the brand's.
  const own = current === 'custom' && bg.color?.startsWith('#') ? bg.color : null;
  const custom = (hex: string, commit: boolean) => edit.style({ background: { color: hex }, textColor: readOn(hex) }, commit ? { commit: true } : undefined);
  return (
    <Popover open={open} onOpenChange={(o) => (setOpen(o), setPicking(false))}>
      <PopoverTrigger asChild>
        <BarMenuButton label="Background" on={open} lead={current === 'photo' ? <PhotosIcon aria-hidden="true" className="size-4" /> : <Dot colour={bg.color ?? null} />}>
          Background
        </BarMenuButton>
      </PopoverTrigger>
      <PopoverContent size="menu" side="bottom" align="start" aria-label="Background" className={picking ? 'w-72' : undefined}>
        {picking ? (
          <div className="p-2">
            <PhotoGrid photos={photos} value={bg.image ?? null} onPick={(image) => set({ image, overlay: 40 }, '#ffffff')} />
          </div>
        ) : (
          <>
            <MenuOption selected={current === 'brand'} onSelect={() => toggle(current === 'brand', { color: BRAND_COLOUR }, readOn(brand))}>
              <span className="mr-2.5 flex"><Dot colour={brand} /></span>
              Brand colour
            </MenuOption>
            <CustomColour value={own} start={brand} swatches={[brand, builder.branding.secondary_color, '#ffffff']} onPick={custom} />
            <MenuOption selected={current === 'photo'} onSelect={() => (current === 'photo' ? set(undefined, undefined) : setPicking(true))}>
              <PhotosIcon aria-hidden="true" className="mr-2.5 size-4 shrink-0 text-zebra-500" />
              Photo
            </MenuOption>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
