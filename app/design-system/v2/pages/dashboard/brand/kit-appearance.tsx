'use client';

import type { CSSProperties, ReactNode } from 'react';

import { ColorField } from '@/components/ui-v2/color-field';
import { HOVER_ON_WHITE } from '@/components/ui-v2/control-styles';
import { Dropdown } from '@/components/ui-v2/dropdown';
import { FileDrop } from '@/components/ui-v2/file-drop';
import { Stepper } from '@/components/ui-v2/stepper';

import { fontStack, FONTS } from '../../onboarding/demo-data';

import { buttonRadiusOf, DEFAULT_SIDE_PADDING, kitHexOf, type BrandKit } from './kit';
import { readLogo, setColour, setHouse, setLogo, setTextStyle } from './kit-edit';
import { KitGroup, KitRow } from './kit-row';

/**
 * The brand kit's look (founder, 2026-10-11): Identity (the logo, the
 * main colour and the documents' background), Type (heading and body faces, each shown in its own
 * face, and the text colour, picked like the main colour) and Shape (how
 * round the page's boxes and its buttons are, in pixels, nudged with a
 * stepper), and Spacing (the side padding inside every section, set once
 * here; a section that sets its own keeps it). The second colour and the logo on dark went: nothing a new
 * MC could see used them.
 *
 * @module app/design-system/v2/pages/dashboard/brand/kit-appearance
 */

const FONT_OPTIONS = FONTS.map((f) => ({ value: f, label: f, fontFamily: fontStack(f) }));

/** How far rounding goes: past this a page's boxes stop reading as boxes. Buttons go further, to a pill. */
const PAGE_MAX = 24;
const BUTTON_MAX = 32;
/** Side padding past this squeezes a phone's column to nothing. */
const PAD_MAX = 120;

/** The logo tile: the picture, or the business's initials in the heading face until one is added. */
function LogoTile({ src, initials }: { src: string | null; initials: string }) {
  return (
    // The initials are the MC's own, in their heading face: the one face override here.
    <span className={`flex h-11 w-20 items-center justify-center overflow-hidden rounded-button bg-field font-[family-name:var(--k-heading)] type-subheading text-zebra-950 ring-1 ring-inset ring-hairline transition-colors duration-150 motion-reduce:transition-none ${HOVER_ON_WHITE}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" className="size-full object-contain p-1.5" /> : initials}
    </span>
  );
}

const ACCEPT = 'image/png,image/svg+xml,image/jpeg,image/webp';

/** The tab. `business` gives the logo tiles their initials until a logo is added. */
export function KitAppearance({ kit, business, onChange }: { kit: BrandKit; business: string; onChange: (kit: BrandKit) => void }) {
  const primary = kitHexOf(kit, 'primary');
  const main = kit.logos.find((l) => l.id === 'main')?.src ?? null;
  const initials = business.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const pick = (id: string) => (file: File) => readLogo(file, (src) => onChange(setLogo(kit, id, src)));
  const font = (roles: ('heading' | 'subheading' | 'body' | 'caption')[]) => (f: string) => onChange(roles.reduce((k, role) => setTextStyle(k, role, { font: f }), kit));
  // The tiles' colour and face, known only at runtime.
  const vars = { '--k-heading': fontStack(kit.text.heading.font) } as CSSProperties;
  const row = (label: string, control: ReactNode) => <KitRow label={label}>{control}</KitRow>;
  return (
    <div className="space-y-8">
      <KitGroup title="Identity">
        <KitRow label="Logo" hint={main ? 'Click to change it' : 'Click to add yours'}>
          <span style={vars}>
            <FileDrop label="Logo" accept={ACCEPT} value={main} onFile={pick('main')} face={<LogoTile src={main} initials={initials} />} />
          </span>
        </KitRow>
        {row('Main colour', <ColorField bare label="Main colour" value={primary} onChange={(hex) => onChange(setColour(kit, 'primary', { hex }))} />)}
        {row('Document background', <ColorField bare label="Document background" value={kitHexOf(kit, 'paper')} onChange={(hex) => onChange(setColour(kit, 'paper', { hex }))} />)}
      </KitGroup>
      <KitGroup title="Type">
        {row('Headings', <Dropdown inline label="Headings" options={FONT_OPTIONS} value={kit.text.heading.font} onChange={font(['heading', 'subheading'])} />)}
        {row('Body', <Dropdown inline label="Body" options={FONT_OPTIONS} value={kit.text.body.font} onChange={font(['body', 'caption'])} />)}
        {row('Text colour', <ColorField bare label="Text colour" value={kitHexOf(kit, 'ink')} onChange={(hex) => onChange(setColour(kit, 'ink', { hex }))} />)}
      </KitGroup>
      <KitGroup title="Shape">
        {row('Page rounding', <Stepper label="Page rounding" value={kit.house.radius} min={0} max={PAGE_MAX} unit="px" onChange={(radius) => onChange(setHouse(kit, { radius, buttonRadius: buttonRadiusOf(kit) }))} />)}
        {row('Button rounding', <Stepper label="Button rounding" value={Math.min(BUTTON_MAX, buttonRadiusOf(kit))} min={0} max={BUTTON_MAX} unit="px" onChange={(buttonRadius) => onChange(setHouse(kit, { buttonRadius }))} />)}
      </KitGroup>
      <KitGroup title="Spacing">
        <KitRow label="Side padding" hint="Inside every section">
          <Stepper label="Side padding" value={kit.house.sidePadding ?? DEFAULT_SIDE_PADDING} min={0} max={PAD_MAX} step={4} unit="px" onChange={(sidePadding) => onChange(setHouse(kit, { sidePadding }))} />
        </KitRow>
      </KitGroup>
    </div>
  );
}
