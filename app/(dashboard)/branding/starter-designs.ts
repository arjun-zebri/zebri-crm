/**
 * Curated starter designs — one-click starting points that set BOTH the
 * brand tokens (a theme) AND a ready-made block layout for every surface.
 *
 * Themes (see `lib/branding/themes.ts`) only set colours + fonts; a
 * starter design goes further and lays out the blocks too (banner
 * on/off, business-name composition, button alignment, framed sections),
 * so a new MC can pick a whole look in one click instead of arranging
 * blocks by hand. Applying one is undoable (it commits one history
 * entry, like applying a theme or a saved kit).
 *
 * The layout is derived from `defaultBlocksFor(surface)` with a small,
 * well-typed "mood" transform, so themes/fonts still flow through and the
 * trees stay valid across all four surfaces.
 *
 * @module app/(dashboard)/branding/starter-designs
 */

import type { ThemeId } from '@/lib/branding/themes'

import { defaultBlocksFor } from './blocks/defaults'
import type { Block } from './blocks/types'

type SurfaceKind = 'proposal' | 'invoice' | 'contract' | 'portal'

/** Visual arrangement layered on the default block tree. */
export type LayoutMood = 'clean' | 'statement' | 'framed' | 'editorial'

export interface StarterDesign {
  id: string
  name: string
  /** One-line summary shown under the card. */
  description: string
  /** Token preset (colours + fonts + density + radius). */
  theme: ThemeId
  /** How the blocks are arranged. */
  mood: LayoutMood
}

export const STARTER_DESIGNS: StarterDesign[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean and typographic, no banner',
    theme: 'minimal',
    mood: 'clean',
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'Big banner, punchy heading',
    theme: 'bold',
    mood: 'statement',
  },
  {
    id: 'elegant',
    name: 'Elegant',
    description: 'Serif with framed sections',
    theme: 'elegant',
    mood: 'framed',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Magazine feel, name-led',
    theme: 'editorial',
    mood: 'clean',
  },
]

const FRAME_BORDER = { borderWidth: 1, borderColor: '#E5E7EB' } as const

/** Apply the mood's field tweaks to a single block (type-narrowed so
 *  every override lands on a field that block actually has). */
function styleBlock(mood: LayoutMood, block: Block): Block {
  switch (block.type) {
    case 'headerBanner':
      if (mood === 'clean' || mood === 'editorial') return { ...block, hidden: true }
      return { ...block, height: mood === 'statement' ? 'lg' : 'md' }
    case 'businessName':
      if (mood === 'statement') return { ...block, layout: 'row' }
      if (mood === 'editorial')
        return { ...block, layout: 'name', nameStyle: { align: 'left' } }
      // clean + framed centre the mark/name over the document.
      return {
        ...block,
        layout: 'stacked',
        nameStyle: { align: 'center' },
        ...(mood === 'framed' ? FRAME_BORDER : {}),
      }
    case 'action':
      return { ...block, buttonJustify: mood === 'statement' ? 'start' : 'center' }
    case 'footer':
      return mood === 'framed' ? { ...block, ...FRAME_BORDER } : block
    default:
      return block
  }
}

/** Build a starter design's block tree for one surface. */
export function starterLayout(mood: LayoutMood, surface: SurfaceKind): Block[] {
  return defaultBlocksFor(surface).map((b) => styleBlock(mood, b))
}
