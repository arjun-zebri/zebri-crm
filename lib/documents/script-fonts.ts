/**
 * Font catalogue for couple scripts.
 *
 * A script is read aloud, often bilingual, and names like "Nguyễn" or a
 * passage in Chinese must render on screen and in print. The branding
 * catalogue (`lib/branding/fonts`) is curated for looks, not coverage, so the
 * script catalogue puts two Noto faces first (Latin-extended, Vietnamese,
 * Greek, Cyrillic in one file) and always appends the Noto CJK families as
 * fallbacks. Google Fonts serves the CJK faces sliced by `unicode-range`, so a
 * script with no CJK text downloads none of it.
 *
 * No React here: the print shell and the editor both import this module.
 *
 * @module lib/documents/script-fonts
 */
import type { JSONContent } from '@tiptap/core'

import { FONT_IDS, FONT_LABELS, FONT_STACKS, GOOGLE_FONT_FAMILIES, type FontId } from '@/lib/branding/fonts'

/** Script-only faces, chosen for glyph coverage rather than looks. */
const COVERAGE_FONT_IDS = ['noto_serif', 'noto_sans'] as const

/** Every face a script may use as its base or per-selection family. */
export const SCRIPT_FONT_IDS = [...COVERAGE_FONT_IDS, ...FONT_IDS] as const

/** A script font id. The DB stores it as text; the Zod schema enforces the enum. */
export type ScriptFontId = (typeof SCRIPT_FONT_IDS)[number]

/** The face a new script starts with: wide coverage, serif, easy to read at a lectern. */
export const DEFAULT_SCRIPT_FONT: ScriptFontId = 'noto_serif'

/** Noto CJK families appended to every script stack so CJK passages never fall to tofu. */
export const CJK_FALLBACK_FAMILIES = ['Noto Sans SC', 'Noto Sans TC', 'Noto Sans JP', 'Noto Sans KR'] as const

/** Google Fonts `family=` values for the CJK fallbacks (regular weight only; they are large). */
const CJK_GOOGLE_FAMILIES = ['Noto+Sans+SC', 'Noto+Sans+TC', 'Noto+Sans+JP', 'Noto+Sans+KR'] as const

/** Primary CSS family name per face, e.g. `"Noto Serif"`. Used as the per-selection mark value. */
export const SCRIPT_FONT_FAMILIES: Record<ScriptFontId, string> = {
  noto_serif: '"Noto Serif"',
  noto_sans: '"Noto Sans"',
  ...(Object.fromEntries(
    FONT_IDS.map((id) => [id, FONT_STACKS[id].split(',')[0]?.trim() ?? `"${FONT_LABELS[id]}"`]),
  ) as Record<FontId, string>),
}

/** Display labels for the font pickers. */
export const SCRIPT_FONT_LABELS: Record<ScriptFontId, string> = {
  noto_serif: 'Noto Serif',
  noto_sans: 'Noto Sans',
  ...FONT_LABELS,
}

/** Google Fonts `family=` value per face. */
const SCRIPT_GOOGLE_FAMILIES: Record<ScriptFontId, string> = {
  noto_serif: 'Noto+Serif:wght@400;500;600;700',
  noto_sans: 'Noto+Sans:wght@400;500;600;700',
  ...GOOGLE_FONT_FAMILIES,
}

/** Whether `id` names a script font. */
export function isScriptFontId(id: string): id is ScriptFontId {
  return (SCRIPT_FONT_IDS as readonly string[]).includes(id)
}

/**
 * The full CSS `font-family` stack for a script's base face: the face, the
 * CJK fallbacks, then a generic family. Applied to the editor wrapper and
 * the print body.
 */
export function scriptFontStack(id: ScriptFontId): string {
  const generic = id === 'noto_sans' || (FONT_STACKS as Record<string, string>)[id]?.includes('sans-serif') ? 'sans-serif' : 'serif'
  const cjk = CJK_FALLBACK_FAMILIES.map((f) => `"${f}"`).join(', ')
  return `${SCRIPT_FONT_FAMILIES[id]}, ${cjk}, ${generic}`
}

/**
 * Map a per-selection `font-family` mark value back to its font id, or null
 * for an unknown or absent value. The toolbar uses this to show the current
 * face; a value from another editor that is not in the catalogue is left as
 * is in the document and shown as unselected.
 */
export function scriptFontIdFromFamily(family: string | null | undefined): ScriptFontId | null {
  if (!family) return null
  const wanted = family.split(',')[0]?.trim().replace(/^["']|["']$/g, '').toLowerCase()
  for (const id of SCRIPT_FONT_IDS) {
    if (SCRIPT_FONT_FAMILIES[id].replace(/^["']|["']$/g, '').toLowerCase() === wanted) return id
  }
  return null
}

/**
 * Every font id a document needs: its base face plus each face used by a
 * `font-family` mark inside the content. Pure tree walk over TipTap JSON.
 */
export function collectScriptFonts(content: JSONContent | null | undefined, base: ScriptFontId): ScriptFontId[] {
  const found = new Set<ScriptFontId>([base])
  const walk = (node: JSONContent | undefined) => {
    if (!node) return
    for (const mark of node.marks ?? []) {
      const family = (mark.attrs as { fontFamily?: string } | undefined)?.fontFamily
      const id = scriptFontIdFromFamily(family)
      if (id) found.add(id)
    }
    for (const child of node.content ?? []) walk(child)
  }
  walk(content ?? undefined)
  return [...found]
}

/**
 * Google Fonts stylesheet URL loading the given faces plus the CJK fallbacks.
 * The editor mounts it as a `<link>`; the print shell inlines it.
 */
export function scriptFontsHref(fonts: readonly ScriptFontId[]): string {
  const unique = Array.from(new Set(fonts))
  const families = [
    ...unique.map((f) => `family=${SCRIPT_GOOGLE_FAMILIES[f]}`),
    ...CJK_GOOGLE_FAMILIES.map((f) => `family=${f}`),
  ].join('&')
  return `https://fonts.googleapis.com/css2?${families}&display=swap`
}
