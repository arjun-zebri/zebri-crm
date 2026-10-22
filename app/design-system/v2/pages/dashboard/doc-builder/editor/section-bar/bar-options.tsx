'use client';

import { useState } from 'react';

import { CollapseIcon, GalleryIcon, LayoutGridIcon, LayoutPanelTopIcon, RowsIcon, SquareIcon, RadiusIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import { BookingTermsSentence } from '../../doc-types/proposal/booking-terms';
import type { DocSection, HeaderLayout } from '../../model/types';
import { leadPrice } from '../../render/couple-page';
import { headerOf } from '../../sections/header/data';
import { useSectionEdit, type SettingsProps } from '../settings/row';
import { AlignChoice } from '../text-bar/align-menu';

import { BarButton } from './bar-parts';
import { PickMenu, type MenuChoice } from './word-menus';

/**
 * The bar's first group: the one choice each kind of section is picked
 * for, as icons to press. A header's Layout (its words under or beside
 * its logo) and alignment; a text section's alignment (the same Align
 * menu as the text bar's); a list's layout;
 * whether answers fold away; a video's corners; and the Accept section's
 * booking terms, a word that opens the editable sentence. The rest of a
 * section's settings wait under the bar's More (`bar-menus.tsx`).
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/section-bar/bar-options
 */

type Choice<T> = { value: T; label: string; icon: ZebriIcon };

/** One icon per choice, the picked one lit. */
function Choices<T extends string>({ choices, value, onPick }: { choices: Choice<T>[]; value: T; onPick: (v: T) => void }) {
  return choices.map((c) => (
    <BarButton key={c.value} label={c.label} on={c.value === value} onClick={() => onPick(c.value)}>
      <c.icon aria-hidden="true" className="size-4" />
    </BarButton>
  ));
}

const CARDS_OR_STACKED: Choice<'cards' | 'stacked'>[] = [
  { value: 'cards', label: 'Side by side', icon: LayoutGridIcon },
  { value: 'stacked', label: 'One under another', icon: RowsIcon },
];
const GALLERY: Choice<'grid' | 'masonry' | 'carousel'>[] = [
  { value: 'grid', label: 'Grid', icon: LayoutGridIcon },
  { value: 'masonry', label: 'Masonry', icon: LayoutPanelTopIcon },
  { value: 'carousel', label: 'Slideshow', icon: GalleryIcon },
];
const CARDS_OR_CAROUSEL: Choice<'cards' | 'carousel'>[] = [
  { value: 'cards', label: 'Side by side', icon: LayoutGridIcon },
  { value: 'carousel', label: 'Slideshow', icon: GalleryIcon },
];

/** The choice `section` is picked for. */
export function BarOptions({ builder, section }: SettingsProps) {
  const edit = useSectionEdit(builder, section);
  const data = section.data;
  // A Header is the engine's own kind, so production's data union does not name it. It starts centred; its logo's size is dragged on the page.
  if ((section as unknown as DocSection).kind === 'header') return <HeaderOptions builder={builder} section={section as unknown as DocSection} onAlign={(align) => edit.pick({ align })} />;
  switch (data?.kind) {
    case 'accept':
      return <TermsButton builder={builder} />;
    case 'packages':
      return <Choices choices={CARDS_OR_STACKED} value={data.packages.layout} onPick={(layout) => edit.data({ kind: 'packages', packages: { ...data.packages, layout } })} />;
    case 'gallery':
      return <Choices choices={GALLERY} value={data.gallery.layout} onPick={(layout) => edit.data({ kind: 'gallery', gallery: { ...data.gallery, layout } })} />;
    case 'testimonials':
      return <Choices choices={CARDS_OR_CAROUSEL} value={data.testimonials.layout} onPick={(layout) => edit.data({ kind: 'testimonials', testimonials: { ...data.testimonials, layout } })} />;
    case 'faq': {
      const folds = data.faq.collapsible ?? true;
      return (
        <BarButton label={folds ? 'Answers fold away' : 'Answers always open'} on={folds} onClick={() => edit.data({ kind: 'faq', faq: { ...data.faq, collapsible: !folds } })}>
          <CollapseIcon aria-hidden="true" className="size-4" />
        </BarButton>
      );
    }
    case 'video': {
      const round = (data.video.cornerRadius ?? builder.branding.corner_radius) > 0;
      const set = (cornerRadius: number) => edit.data({ kind: 'video', video: { ...data.video, cornerRadius } });
      // Exact rounding stays under More; here it is square or the brand's corners.
      return (
        <>
          <BarButton label="Square corners" on={!round} onClick={() => set(0)}>
            <SquareIcon aria-hidden="true" className="size-4" />
          </BarButton>
          <BarButton label="Rounded corners" on={round} onClick={() => set(builder.branding.corner_radius || 12)}>
            <RadiusIcon aria-hidden="true" className="size-4" />
          </BarButton>
        </>
      );
    }
    default:
      return <AlignChoice value={section.style.align ?? 'left'} onPick={(align) => edit.pick({ align })} />;
  }
}

const HEADER_LAYOUT: MenuChoice<HeaderLayout>[] = [
  { value: 'below', label: 'Words under the logo' },
  { value: 'beside', label: 'Words beside the logo' },
];

/** A Header's choices: a Layout menu (its words under or beside the logo, said in words), then where it all sits. */
function HeaderOptions({ builder, section, onAlign }: { builder: SettingsProps['builder']; section: DocSection; onAlign: (align: 'left' | 'center' | 'right') => void }) {
  const data = headerOf(section);
  const setLayout = (layout: HeaderLayout) => builder.dispatch({ type: 'setData', id: section.id, data: { kind: 'header', header: { ...data, layout } } }, { commit: true });
  return (
    <>
      <PickMenu label="Layout" choices={HEADER_LAYOUT} value={data.layout ?? 'below'} onPick={setLayout} />
      <AlignChoice value={section.style.align ?? 'left'} onPick={onAlign} />
    </>
  );
}

/** Booking terms: a word on the bar that opens the editable sentence under it. */
function TermsButton({ builder }: { builder: SettingsProps['builder'] }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <BarButton label="Booking terms" tip={false} toggle={false} on={open}>
          Booking terms
        </BarButton>
      </PopoverTrigger>
      <PopoverContent size="card" side="bottom" align="start" aria-label="Booking terms">
        <BookingTermsSentence terms={builder.terms} onTerms={builder.setTerms} theme={builder.theme} price={leadPrice(builder.state.layout)} place="popover" />
      </PopoverContent>
    </Popover>
  );
}
