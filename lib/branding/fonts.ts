export const HEADING_FONTS = [
  'inter',
  'playfair',
  'dm_serif',
  'space_grotesk',
  'cormorant',
  'fraunces',
  'manrope',
  'libre_baskerville',
  'sora',
  'bricolage',
  'crimson_pro',
  'instrument_serif',
] as const

export const BODY_FONTS = [
  'inter',
  'dm_sans',
  'manrope',
  'lora',
  'source_sans',
  'public_sans',
  'work_sans',
] as const

export type HeadingFont = (typeof HEADING_FONTS)[number]
export type BodyFont = (typeof BODY_FONTS)[number]

export const FONT_LABELS: Record<HeadingFont | BodyFont, string> = {
  inter: 'Inter',
  playfair: 'Playfair Display',
  dm_serif: 'DM Serif Display',
  space_grotesk: 'Space Grotesk',
  cormorant: 'Cormorant Garamond',
  fraunces: 'Fraunces',
  manrope: 'Manrope',
  libre_baskerville: 'Libre Baskerville',
  sora: 'Sora',
  bricolage: 'Bricolage Grotesque',
  crimson_pro: 'Crimson Pro',
  instrument_serif: 'Instrument Serif',
  dm_sans: 'DM Sans',
  lora: 'Lora',
  source_sans: 'Source Sans 3',
  public_sans: 'Public Sans',
  work_sans: 'Work Sans',
}

export const FONT_STACKS: Record<HeadingFont | BodyFont, string> = {
  inter: '"Inter", ui-sans-serif, system-ui, sans-serif',
  playfair: '"Playfair Display", "Times New Roman", serif',
  dm_serif: '"DM Serif Display", "Times New Roman", serif',
  space_grotesk: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
  cormorant: '"Cormorant Garamond", "Times New Roman", serif',
  fraunces: '"Fraunces", "Times New Roman", serif',
  manrope: '"Manrope", ui-sans-serif, system-ui, sans-serif',
  libre_baskerville: '"Libre Baskerville", "Times New Roman", serif',
  sora: '"Sora", ui-sans-serif, system-ui, sans-serif',
  bricolage: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif',
  crimson_pro: '"Crimson Pro", "Times New Roman", serif',
  instrument_serif: '"Instrument Serif", "Times New Roman", serif',
  dm_sans: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
  lora: '"Lora", "Times New Roman", serif',
  source_sans: '"Source Sans 3", ui-sans-serif, system-ui, sans-serif',
  public_sans: '"Public Sans", ui-sans-serif, system-ui, sans-serif',
  work_sans: '"Work Sans", ui-sans-serif, system-ui, sans-serif',
}

const GOOGLE_FONT_FAMILIES: Record<HeadingFont | BodyFont, string> = {
  inter: 'Inter:wght@400;500;600;700',
  playfair: 'Playfair+Display:wght@400;500;600;700',
  dm_serif: 'DM+Serif+Display',
  space_grotesk: 'Space+Grotesk:wght@400;500;600;700',
  cormorant: 'Cormorant+Garamond:wght@400;500;600;700',
  fraunces: 'Fraunces:wght@400;500;600;700',
  manrope: 'Manrope:wght@400;500;600;700',
  libre_baskerville: 'Libre+Baskerville:wght@400;700',
  sora: 'Sora:wght@400;500;600;700',
  bricolage: 'Bricolage+Grotesque:wght@400;500;600;700',
  crimson_pro: 'Crimson+Pro:wght@400;500;600;700',
  instrument_serif: 'Instrument+Serif',
  dm_sans: 'DM+Sans:wght@400;500;600;700',
  lora: 'Lora:wght@400;500;600;700',
  source_sans: 'Source+Sans+3:wght@400;500;600;700',
  public_sans: 'Public+Sans:wght@400;500;600;700',
  work_sans: 'Work+Sans:wght@400;500;600;700',
}

export function googleFontsHref(fonts: (HeadingFont | BodyFont)[]): string {
  const unique = Array.from(new Set(fonts))
  const families = unique.map(f => `family=${GOOGLE_FONT_FAMILIES[f]}`).join('&')
  return `https://fonts.googleapis.com/css2?${families}&display=swap`
}

export const FONT_WEIGHTS = [400, 500, 600, 700] as const
export type FontWeight = (typeof FONT_WEIGHTS)[number]

export const FONT_WEIGHT_LABELS: Record<FontWeight, string> = {
  400: 'Regular',
  500: 'Medium',
  600: 'Semibold',
  700: 'Bold',
}
