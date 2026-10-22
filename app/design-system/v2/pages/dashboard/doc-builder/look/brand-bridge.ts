import { defaultTheme } from '@/features/proposals';
import type { ProposalTheme, ThemeTextStyle } from '@/features/proposals';
import { FONT_IDS, FONT_LABELS, type FontId } from '@/lib/branding/fonts';
import { buildPublicBranding, type PublicBranding } from '@/lib/branding/public-branding';


import { buttonRadiusOf, DEFAULT_SIDE_PADDING, kitHex, type BrandKit, type KitTextStyle } from '../../brand/kit';

/**
 * The bridge between the v2 brand kit and production's proposal engine.
 * The builder reuses production's section model, renderer and rich-text
 * editor (`features/proposals`), which read a `PublicBranding` and a
 * `ProposalTheme`; this builds both from the kit, so the kit stays the
 * one place a look is set (spec §3) and every web document follows it
 * while it is a draft.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/look/brand-bridge
 */

/** A kit face as a font id. The v2 kit stores the label ("Italiana"); production wants the id. */
export function fontIdOf(face: string): FontId {
  if ((FONT_IDS as readonly string[]).includes(face)) return face as FontId;
  return FONT_IDS.find((id) => FONT_LABELS[id].toLowerCase() === face.toLowerCase()) ?? 'inter';
}
const fontOf = fontIdOf;

/** How couples reach the business, when the account has said. */
export interface BrandContact {
  abn: string;
  phone: string;
}

/** The kit as production's branding: colours, fonts, logo, and the business's name and details. */
export function kitBranding(kit: BrandKit, business: string, contact?: BrandContact | undefined): PublicBranding {
  const brand = kitHex(kit, 'primary') ?? '#1f3d2b';
  const ink = kitHex(kit, 'ink') ?? '#161615';
  const logo = kit.logos.find((l) => l.id === 'main')?.src;
  return buildPublicBranding({
    business_name: business,
    brand_color: brand,
    secondary_color: kitHex(kit, 'accent') ?? brand,
    heading_color: ink,
    subheading_color: kitHex(kit, 'muted') ?? ink,
    text_color: ink,
    // Production reads the page's colour from surface_color (page_background only aliases it).
    surface_color: kitHex(kit, 'paper') ?? '#ffffff',
    page_background: kitHex(kit, 'paper') ?? '#ffffff',
    font_heading: fontOf(kit.text.heading.font),
    font_body: fontOf(kit.text.body.font),
    corner_radius: kit.house.radius,
    button_variant: kit.house.button === 'outline' ? 'outline' : 'fill',
    button_radius: buttonRadiusOf(kit),
    ...(logo ? { logo_url: logo } : {}),
    ...(contact ? { abn: contact.abn, phone: contact.phone } : {}),
  });
}

/** One kit text style as a theme role, keeping the role's colour and alignment. */
function role(base: ThemeTextStyle, s: KitTextStyle, size: number): ThemeTextStyle {
  return {
    ...base,
    font: fontOf(s.font),
    size,
    weight: s.weight as ThemeTextStyle['weight'],
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    case: s.uppercase ? 'uppercase' : 'none',
  };
}

/**
 * The page theme a web document wears while it follows the brand: the
 * production default for spacing and flow, with the kit's text styles on
 * the four roles (Heading 1 is the kit's heading, Heading 2 and 3 its
 * subheading at two sizes, Paragraph its body). Sending freezes this onto
 * the layout (`layout.theme`), so a later kit change never reaches a
 * document the couple already has.
 */
export function kitTheme(kit: BrandKit, branding: PublicBranding): ProposalTheme {
  const base = defaultTheme(branding);
  const { heading, subheading, body } = kit.text;
  return {
    ...base,
    // Set once in the brand kit; a section that sets its own still wins.
    sectionPaddingX: kit.house.sidePadding ?? DEFAULT_SIDE_PADDING,
    text: {
      heading1: role(base.text.heading1, heading, heading.size),
      heading2: role(base.text.heading2, subheading, subheading.size + 4),
      // In the text colour, not the muted one: a thin display face at this size in a muted grey all but vanished (2026-10-05 review).
      heading3: { ...role(base.text.heading3, subheading, Math.max(16, subheading.size - 4)), color: branding.heading_color },
      paragraph: role(base.text.paragraph, body, body.size + 1),
    },
  };
}
