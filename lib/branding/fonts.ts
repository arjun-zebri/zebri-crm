/**
 * Script (cursive) faces: wedding-appropriate handwriting and calligraphy
 * styles. Listed separately because they are heading and accent faces only;
 * {@link BODY_FONTS} leaves them out so a whole page can never be set in
 * cursive by accident.
 * @public
 */
export const SCRIPT_FONT_IDS = [
  'great_vibes',
  'dancing_script',
  'parisienne',
  'allura',
  'alex_brush',
  'pinyon_script',
  'sacramento',
  'satisfy',
] as const

/**
 * Complete catalogue of font IDs available for branding.
 * Sans-serif and serif typefaces curated for professional use, plus the
 * script faces in {@link SCRIPT_FONT_IDS}.
 * @public
 */
export const FONT_IDS = [
  // Sans-serif fonts
  'inter',
  'dm_sans',
  'manrope',
  'space_grotesk',
  'sora',
  'work_sans',
  'public_sans',
  'poppins',
  'montserrat',
  'raleway',
  'nunito',
  'karla',
  'epilogue',
  'outfit',
  'figtree',
  'josefin_sans',
  'ibm_plex_sans',
  'be_vietnam',
  'unbounded',
  'jost',
  'syne',
  // Serif fonts
  'playfair',
  'dm_serif',
  'cormorant',
  'fraunces',
  'libre_baskerville',
  'bricolage',
  'crimson_pro',
  'instrument_serif',
  'lora',
  'source_sans',
  'spectral',
  'eb_garamond',
  'cardo',
  'marcellus',
  'prata',
  'ibm_plex_serif',
  'gilda_display',
  'italiana',
  'forum',
  // Script fonts
  ...SCRIPT_FONT_IDS,
] as const

/**
 * FontId type represents any available font in the catalogue.
 * @public
 */
export type FontId = (typeof FONT_IDS)[number]

/**
 * Fonts a heading may use: the whole catalogue, script faces included.
 * @public
 */
export const HEADING_FONTS: readonly FontId[] = FONT_IDS

/**
 * Fonts a body may use: the catalogue minus the script faces (see
 * {@link SCRIPT_FONT_IDS}). The proposal builder's per-text font pickers
 * read `FONT_IDS` directly, so a cursive run inside a paragraph is still
 * possible there; only Branding's page-wide body font excludes them.
 * @public
 */
export const BODY_FONTS: readonly FontId[] = FONT_IDS.filter((id) => !(SCRIPT_FONT_IDS as readonly string[]).includes(id))

/**
 * HeadingFont is an alias for FontId, maintained for back-compatibility.
 * @public
 */
export type HeadingFont = FontId

/**
 * BodyFont is an alias for FontId, maintained for back-compatibility.
 * @public
 */
export type BodyFont = FontId

/**
 * Display labels for each font in the catalogue.
 * @public
 */
export const FONT_LABELS: Record<FontId, string> = {
  // Sans-serif fonts
  inter: 'Inter',
  dm_sans: 'DM Sans',
  manrope: 'Manrope',
  space_grotesk: 'Space Grotesk',
  sora: 'Sora',
  work_sans: 'Work Sans',
  public_sans: 'Public Sans',
  poppins: 'Poppins',
  montserrat: 'Montserrat',
  raleway: 'Raleway',
  nunito: 'Nunito',
  karla: 'Karla',
  epilogue: 'Epilogue',
  outfit: 'Outfit',
  figtree: 'Figtree',
  josefin_sans: 'Josefin Sans',
  ibm_plex_sans: 'IBM Plex Sans',
  be_vietnam: 'Be Vietnam',
  unbounded: 'Unbounded',
  jost: 'Jost',
  syne: 'Syne',
  // Serif fonts
  playfair: 'Playfair Display',
  dm_serif: 'DM Serif Display',
  cormorant: 'Cormorant Garamond',
  fraunces: 'Fraunces',
  libre_baskerville: 'Libre Baskerville',
  bricolage: 'Bricolage Grotesque',
  crimson_pro: 'Crimson Pro',
  instrument_serif: 'Instrument Serif',
  lora: 'Lora',
  source_sans: 'Source Sans 3',
  spectral: 'Spectral',
  eb_garamond: 'EB Garamond',
  cardo: 'Cardo',
  marcellus: 'Marcellus',
  prata: 'Prata',
  ibm_plex_serif: 'IBM Plex Serif',
  gilda_display: 'Gilda Display',
  italiana: 'Italiana',
  forum: 'Forum',
  // Script fonts
  great_vibes: 'Great Vibes',
  dancing_script: 'Dancing Script',
  parisienne: 'Parisienne',
  allura: 'Allura',
  alex_brush: 'Alex Brush',
  pinyon_script: 'Pinyon Script',
  sacramento: 'Sacramento',
  satisfy: 'Satisfy',
}

/**
 * CSS font-stack strings for each font, including fallback families.
 * Each stack contains a comma for proper cascade fallback.
 * @public
 */
export const FONT_STACKS: Record<FontId, string> = {
  // Sans-serif fonts
  inter: '"Inter", ui-sans-serif, system-ui, sans-serif',
  dm_sans: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
  manrope: '"Manrope", ui-sans-serif, system-ui, sans-serif',
  space_grotesk: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
  sora: '"Sora", ui-sans-serif, system-ui, sans-serif',
  work_sans: '"Work Sans", ui-sans-serif, system-ui, sans-serif',
  public_sans: '"Public Sans", ui-sans-serif, system-ui, sans-serif',
  poppins: '"Poppins", ui-sans-serif, system-ui, sans-serif',
  montserrat: '"Montserrat", ui-sans-serif, system-ui, sans-serif',
  raleway: '"Raleway", ui-sans-serif, system-ui, sans-serif',
  nunito: '"Nunito", ui-sans-serif, system-ui, sans-serif',
  karla: '"Karla", ui-sans-serif, system-ui, sans-serif',
  epilogue: '"Epilogue", ui-sans-serif, system-ui, sans-serif',
  outfit: '"Outfit", ui-sans-serif, system-ui, sans-serif',
  figtree: '"Figtree", ui-sans-serif, system-ui, sans-serif',
  josefin_sans: '"Josefin Sans", ui-sans-serif, system-ui, sans-serif',
  ibm_plex_sans: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
  be_vietnam: '"Be Vietnam", ui-sans-serif, system-ui, sans-serif',
  unbounded: '"Unbounded", ui-sans-serif, system-ui, sans-serif',
  jost: '"Jost", ui-sans-serif, system-ui, sans-serif',
  syne: '"Syne", ui-sans-serif, system-ui, sans-serif',
  // Serif fonts
  playfair: '"Playfair Display", "Times New Roman", serif',
  dm_serif: '"DM Serif Display", "Times New Roman", serif',
  cormorant: '"Cormorant Garamond", "Times New Roman", serif',
  fraunces: '"Fraunces", "Times New Roman", serif',
  libre_baskerville: '"Libre Baskerville", "Times New Roman", serif',
  bricolage: '"Bricolage Grotesque", "Times New Roman", serif',
  crimson_pro: '"Crimson Pro", "Times New Roman", serif',
  instrument_serif: '"Instrument Serif", "Times New Roman", serif',
  lora: '"Lora", "Times New Roman", serif',
  source_sans: '"Source Sans 3", "Times New Roman", serif',
  spectral: '"Spectral", "Times New Roman", serif',
  eb_garamond: '"EB Garamond", "Times New Roman", serif',
  cardo: '"Cardo", "Times New Roman", serif',
  marcellus: '"Marcellus", "Times New Roman", serif',
  prata: '"Prata", "Times New Roman", serif',
  ibm_plex_serif: '"IBM Plex Serif", "Times New Roman", serif',
  gilda_display: '"Gilda Display", "Times New Roman", serif',
  italiana: '"Italiana", "Times New Roman", serif',
  forum: '"Forum", "Times New Roman", serif',
  // Script fonts. "Brush Script MT" is the same fallback the signature
  // stack uses (`signature-font.ts`), so a script heading and a signature
  // degrade to the same face when Google Fonts is unreachable.
  great_vibes: '"Great Vibes", "Brush Script MT", cursive',
  dancing_script: '"Dancing Script", "Brush Script MT", cursive',
  parisienne: '"Parisienne", "Brush Script MT", cursive',
  allura: '"Allura", "Brush Script MT", cursive',
  alex_brush: '"Alex Brush", "Brush Script MT", cursive',
  pinyon_script: '"Pinyon Script", "Brush Script MT", cursive',
  sacramento: '"Sacramento", "Brush Script MT", cursive',
  satisfy: '"Satisfy", "Brush Script MT", cursive',
}

/**
 * Google Fonts family strings for each font, with weight axes where available.
 * Format: "FontName+With+Plus:wght@weights" or "FontName" for single-weight fonts.
 * @public
 */
export const GOOGLE_FONT_FAMILIES: Record<FontId, string> = {
  // Sans-serif fonts
  inter: 'Inter:wght@400;500;600;700',
  dm_sans: 'DM+Sans:wght@400;500;600;700',
  manrope: 'Manrope:wght@400;500;600;700',
  space_grotesk: 'Space+Grotesk:wght@400;500;600;700',
  sora: 'Sora:wght@400;500;600;700',
  work_sans: 'Work+Sans:wght@400;500;600;700',
  public_sans: 'Public+Sans:wght@400;500;600;700',
  poppins: 'Poppins:wght@400;500;600;700',
  montserrat: 'Montserrat:wght@400;500;600;700',
  raleway: 'Raleway:wght@400;500;600;700',
  nunito: 'Nunito:wght@400;500;600;700',
  karla: 'Karla:wght@400;500;600;700',
  epilogue: 'Epilogue:wght@400;500;600;700',
  outfit: 'Outfit:wght@400;500;600;700',
  figtree: 'Figtree:wght@400;500;600;700',
  josefin_sans: 'Josefin+Sans:wght@400;500;600;700',
  ibm_plex_sans: 'IBM+Plex+Sans:wght@400;500;600;700',
  be_vietnam: 'Be+Vietnam:wght@400;500;600;700',
  unbounded: 'Unbounded:wght@400;500;600;700',
  jost: 'Jost:wght@400;500;600;700',
  syne: 'Syne:wght@400;500;600;700',
  // Serif fonts
  playfair: 'Playfair+Display:wght@400;500;600;700',
  dm_serif: 'DM+Serif+Display',
  cormorant: 'Cormorant+Garamond:wght@400;500;600;700',
  fraunces: 'Fraunces:wght@400;500;600;700',
  libre_baskerville: 'Libre+Baskerville:wght@400;700',
  bricolage: 'Bricolage+Grotesque:wght@400;500;600;700',
  crimson_pro: 'Crimson+Pro:wght@400;500;600;700',
  instrument_serif: 'Instrument+Serif',
  lora: 'Lora:wght@400;500;600;700',
  source_sans: 'Source+Sans+3:wght@400;500;600;700',
  spectral: 'Spectral:wght@400;500;600;700',
  eb_garamond: 'EB+Garamond:wght@400;500;600;700',
  cardo: 'Cardo',
  marcellus: 'Marcellus',
  prata: 'Prata',
  ibm_plex_serif: 'IBM+Plex+Serif:wght@400;500;600;700',
  gilda_display: 'Gilda+Display',
  italiana: 'Italiana',
  forum: 'Forum',
  // Script fonts. Only Dancing Script ships a weight axis; the rest are
  // single-weight and faux-bold in the browser like Cardo or Prata do.
  great_vibes: 'Great+Vibes',
  dancing_script: 'Dancing+Script:wght@400;500;600;700',
  parisienne: 'Parisienne',
  allura: 'Allura',
  alex_brush: 'Alex+Brush',
  pinyon_script: 'Pinyon+Script',
  sacramento: 'Sacramento',
  satisfy: 'Satisfy',
}

/** `FONT_STACKS` inverted, so a stored stack string finds its id in one lookup. */
const FONT_ID_BY_STACK: ReadonlyMap<string, FontId> = new Map(FONT_IDS.map((id) => [FONT_STACKS[id], id]))

/**
 * The `FontId` whose {@link FONT_STACKS} entry equals `stack`, or `null`
 * when `stack` is unset or matches no catalogue font. The proposal editor
 * stores a `textStyle` mark's `fontFamily` as the raw stack string (the
 * renderer assigns it to CSS verbatim), so this is how anything that needs
 * the id back (the Font select, the public page's font loader) gets it.
 * @public
 */
export function fontIdFromStack(stack: string | null | undefined): FontId | null {
  if (!stack) return null
  return FONT_ID_BY_STACK.get(stack) ?? null
}

/**
 * Generate a Google Fonts CSS href for the given fonts.
 * @param fonts - Array of font IDs to load
 * @returns CSS link href for Google Fonts API
 * @public
 */
export function googleFontsHref(fonts: FontId[]): string {
  const unique = Array.from(new Set(fonts))
  const families = unique.map(f => `family=${GOOGLE_FONT_FAMILIES[f]}`).join('&')
  return `https://fonts.googleapis.com/css2?${families}&display=swap`
}

/** `id` of the `<link>` {@link ensureBrandFontsStylesheet} injects, so a second caller finds the first one's. */
const BRAND_FONTS_LINK_ID = 'zebri-brand-fonts'

/**
 * Appends one Google Fonts stylesheet for every branding font to
 * `document.head`, once per page, so a font picker can preview each face
 * and a canvas can paint any font a user might pick. Idempotent and
 * SSR-safe (a no-op without `document`). The Branding editor and the
 * proposal template editor both call this on mount.
 * @public
 */
export function ensureBrandFontsStylesheet(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(BRAND_FONTS_LINK_ID)) return
  const link = document.createElement('link')
  link.id = BRAND_FONTS_LINK_ID
  link.rel = 'stylesheet'
  link.href = googleFontsHref([...FONT_IDS])
  document.head.appendChild(link)
}

/**
 * Available font weights for typography.
 * @public
 */
export const FONT_WEIGHTS = [400, 500, 600, 700] as const

/**
 * FontWeight type represents supported font weight values.
 * @public
 */
export type FontWeight = (typeof FONT_WEIGHTS)[number]

/**
 * Display labels for each font weight.
 * @public
 */
export const FONT_WEIGHT_LABELS: Record<FontWeight, string> = {
  400: 'Regular',
  500: 'Medium',
  600: 'Semibold',
  700: 'Bold',
}
