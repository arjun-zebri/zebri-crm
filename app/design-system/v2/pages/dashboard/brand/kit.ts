import type { JSONContent } from '@tiptap/react';

import type { Brand } from '../../onboarding/use-onboarding-state';
import type { TextRole } from '../canvas/model';

import { accentOf, DEFAULT_BRAND } from './palettes';

/**
 * The brand kit: everything an MC's documents can be made of, the way
 * Canva's brand kit works. Logos in their versions, named colours in
 * palettes, a text style per role (heading, subheading, body, caption),
 * the house style (corners, buttons), and the photos and graphics they
 * have uploaded. Every canvas element refers to the kit where it can, so
 * changing a kit colour or text style restyles every document at once.
 *
 * The older one-colour `Brand` the existing document renderers read is
 * derived from the kit ({@link brandOf}), so those keep working unchanged.
 *
 * @module app/design-system/v2/pages/dashboard/brand/kit
 */

export interface KitColour {
  /** Stable, referenced by elements as `kit:<id>`. */
  id: string;
  name: string;
  hex: string;
}

export interface KitPalette {
  id: string;
  name: string;
  colours: KitColour[];
}

export interface KitTextStyle {
  font: string;
  /** In page pixels. */
  size: number;
  weight: number;
  lineHeight: number;
  /** In em. */
  letterSpacing: number;
  uppercase: boolean;
}

export interface KitLogo {
  id: string;
  /** "Main", "Mark", "On dark". */
  name: string;
  src: string | null;
}

export interface KitAsset {
  id: string;
  name: string;
  src: string;
}

/** Who the business is, as documents and emails name it. Left out, the account's own details stand. */
export interface KitDetails {
  business: string;
  /** The MC's own name, which signs proposals and emails. */
  name: string;
  /** What they are to the couple: "MC", "Celebrant". */
  role: string;
  phone: string;
  email: string;
  abn: string;
  /** Shown in the email signature when it is set. */
  website?: string | undefined;
}

/** How every email starts and ends, unless one email says otherwise. */
export interface KitEmail {
  /** What heads it: the business name, the logo, or nothing; left out until the MC picks, see {@link emailHeaderOf}. */
  header?: 'name' | 'logo' | 'none' | undefined;
  /** The words above the signature ("Warmly,"). */
  signOff: string;
  /** What the signature shows under the MC's name; left out, {@link DEFAULT_SIGNATURE}. */
  signature?: KitSignature | undefined;
}

/**
 * The email signature, set in Settings > Email. The name, role, phone and
 * website come from Business, so they can never disagree with the
 * documents; this only says which of them show, and one line of the MC's
 * own ("Replies within one business day").
 */
export interface KitSignature {
  logo: boolean;
  role: boolean;
  phone: boolean;
  website: boolean;
  /** A last line of the MC's own; empty for none. */
  note: string;
  /**
   * The signature the MC wrote in Settings > Email, as TipTap JSON in
   * production's signature schema (user, 2026-10-15: "like the one
   * currently in production"). When set, it is the Full signature, in
   * place of the one built from the switches above.
   */
  content?: JSONContent | undefined;
}

/** The signature before the MC changes it: everything shown, no extra line. */
export const DEFAULT_SIGNATURE: KitSignature = {
  logo: true,
  role: true,
  phone: true,
  website: true,
  note: '',
};

export interface BrandKit {
  logos: KitLogo[];
  palettes: KitPalette[];
  text: Record<TextRole, KitTextStyle>;
  /**
   * `radius` rounds the page's boxes; `buttonRadius` rounds its buttons
   * (`radius` when left out); `sidePadding` is the room either side of
   * every section's content, unless a section sets its own. All in pixels.
   */
  house: {
    radius: number;
    button: 'solid' | 'outline' | 'pill';
    buttonRadius?: number | undefined;
    sidePadding?: number | undefined;
  };
  assets: KitAsset[];
  /** Set from Settings > Business; left out until the MC changes one. */
  details?: KitDetails | undefined;
  /** Set from Settings > Email; left out until the MC changes one. */
  email?: KitEmail | undefined;
}

/** Every email's start and end before the MC changes them. */
// No header: left to `emailHeaderOf`, so saving another email setting (the signature) never turns the logo off.
export const DEFAULT_EMAIL: KitEmail = { signOff: 'Warmly,' };

/**
 * What heads every email: as Settings > Email says once the MC picks, else
 * the logo when Global styling has one (founder, 2026-10-21: an email
 * opened on "You" set in type while a logo sat unused), else the name.
 */
export const emailHeaderOf = (kit: BrandKit): NonNullable<KitEmail['header']> =>
  kit.email?.header ?? (kit.logos.find((l) => l.id === 'main')?.src ? 'logo' : 'name');

/** A kit's button rounding in pixels: its own, else a pill's, else the page's. */
export const buttonRadiusOf = (kit: BrandKit) =>
  kit.house.buttonRadius ?? (kit.house.button === 'pill' ? 999 : kit.house.radius);

/** Every section's side padding before the MC changes it: production's "cozy". */
export const DEFAULT_SIDE_PADDING = 32;

/** The text roles in the order the kit lists them. */
export const ROLES: { role: TextRole; label: string; all: string }[] = [
  { role: 'heading', label: 'Heading', all: 'All headings' },
  { role: 'subheading', label: 'Subheading', all: 'All subheadings' },
  { role: 'body', label: 'Body', all: 'All body text' },
  { role: 'caption', label: 'Caption', all: 'All captions' },
];

/** A kit built from a one-colour brand: what an account starts with. */
export function kitFrom(brand: Brand = DEFAULT_BRAND): BrandKit {
  return {
    logos: [
      { id: 'main', name: 'Main', src: brand.logoUrl },
      { id: 'mark', name: 'Mark', src: null },
      { id: 'light', name: 'On dark', src: null },
    ],
    palettes: [
      {
        id: 'brand',
        name: 'Brand',
        colours: [
          { id: 'primary', name: 'Brand', hex: brand.primary },
          { id: 'accent', name: 'Accent', hex: brand.secondary || accentOf(brand.primary) },
        ],
      },
      {
        id: 'neutrals',
        name: 'Neutrals',
        colours: [
          { id: 'ink', name: 'Ink', hex: '#161615' },
          { id: 'muted', name: 'Muted', hex: '#7a7a74' },
          { id: 'paper', name: 'Paper', hex: '#ffffff' },
        ],
      },
    ],
    text: {
      heading: {
        font: brand.headingFont,
        size: 44,
        weight: 400,
        lineHeight: 1.1,
        letterSpacing: 0,
        uppercase: false,
      },
      subheading: {
        font: brand.headingFont,
        size: 24,
        weight: 400,
        lineHeight: 1.25,
        letterSpacing: 0,
        uppercase: false,
      },
      body: {
        font: brand.bodyFont,
        size: 15,
        weight: 400,
        lineHeight: 1.6,
        letterSpacing: 0,
        uppercase: false,
      },
      caption: {
        font: brand.bodyFont,
        size: 11,
        weight: 500,
        lineHeight: 1.4,
        letterSpacing: 0.12,
        uppercase: true,
      },
    },
    house: { radius: 6, button: 'solid', buttonRadius: 6 },
    assets: [],
  };
}

/** Every kit colour, palettes flattened. */
export const kitColours = (kit: BrandKit) => kit.palettes.flatMap((p) => p.colours);

/** A kit colour's hex by id, or undefined. */
export const kitHex = (kit: BrandKit, id: string) => kitColours(kit).find((c) => c.id === id)?.hex;

/** The kit every account starts with: where a missing colour's fallback comes from. */
const STARTING_KIT = kitFrom();

/**
 * A kit colour's hex by id, never missing: the kit's own, else the
 * starting kit's (its ink for an id the starting kit lacks too). Every
 * fallback reads from here, so none can disagree with the kit defaults.
 */
export const kitHexOf = (kit: BrandKit, id: string): string =>
  kitHex(kit, id) ??
  kitHex(STARTING_KIT, id) ??
  kitHex(STARTING_KIT, 'ink') ??
  DEFAULT_BRAND.primary;

/** The one-colour brand the existing renderers read, from the kit. */
export function brandOf(kit: BrandKit): Brand {
  return {
    primary: kitHex(kit, 'primary') ?? DEFAULT_BRAND.primary,
    secondary: kitHex(kit, 'accent') ?? DEFAULT_BRAND.secondary,
    headingFont: kit.text.heading.font,
    bodyFont: kit.text.body.font,
    logoUrl: kit.logos.find((l) => l.id === 'main')?.src ?? null,
    paper: kitHexOf(kit, 'paper'),
  };
}
