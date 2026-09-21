/**
 * Proposal Layout v2 data model (spec §2.1, §2.4). A proposal is a stack of
 * full-width sections; a content section is one rich doc, a data section
 * carries the data its kind renders. This file is types only: the Zod
 * schema in `./schema.ts` is the runtime authority and must be kept in
 * step with it.
 *
 * @module features/proposals/model/layout
 */
import type { JSONContent } from '@tiptap/core'

// Temporary, type-only (Phase 3 gives the data sections their own types).
import type {
  AcceptBlock, FaqBlock, GalleryBlock, PackagesBlock, TestimonialsBlock, VideoBlock,
} from '@/app/(dashboard)/branding/blocks/types'

import type { PackageOption } from './packages'
import type { ProposalTheme } from './theme'

/** A TipTap document. Always normalised with `toPlainJSON` before storage. */
export type RichDoc = JSONContent

/**
 * Kind of section determining its visual rendering and data fields.
 * `pageBreak` is the one kind with nothing to render: it marks where the
 * next page starts in step flow (`./pages.ts`) and is skipped everywhere
 * else. It still lives in `sections[]` so the editor's reorder, select,
 * delete and undo all cover it with no special casing.
 */
export type SectionKind = 'content' | 'packages' | 'gallery' | 'video' | 'testimonials' | 'faq' | 'accept' | 'pageBreak'

/** Named column widths; a number is a dragged px width (Phase 2). */
export type ContentWidth = 'narrow' | 'medium' | 'wide' | number
/** Named vertical rhythm stops; a number is a dragged px padding (Phase 2). */
export type SectionPadding = 'compact' | 'cozy' | 'roomy' | number

/** Background styling for a section (color, image, video, or overlay). */
export interface SectionBackground {
  /** CSS color value for the background. */
  color?: string
  /** Storage URL of an image. */
  image?: string
  /** Storage URL of a video, played muted and looped behind the content. */
  video?: string
  /**
   * Storage URL of a poster image for `video`: shown before playback starts
   * and stands in for the video in print mode, which never plays media.
   */
  poster?: string
  /** 0-100 black overlay over image / video. */
  overlay?: number
  /**
   * Focal point of `image`, as `object-position` percentages (0-100 each,
   * `{ x: 50, y: 50 }` when unset): which part of the photo survives the
   * `object-cover` crop when the section is a different shape to it.
   */
  position?: { x: number; y: number }
}

/** Visual styling for one section: background, height, width, padding and text colour/alignment. */
export interface SectionStyle {
  background?: SectionBackground
  /** `full` pins the section to one screen (`100svh`); the hero case. */
  height: 'fit' | 'full'
  /**
   * Content column width. Absent means "inherit the theme's `contentWidth`"
   * (the Page width in Global style), the same inheritance as `padding`
   * below, so retuning the page re-flows every section that never chose
   * its own. Data sections set theirs deliberately (packages wide, video
   * narrow) and so keep it.
   */
  contentWidth?: ContentWidth | undefined
  /**
   * Vertical padding. Absent means "inherit the theme's `sectionPadding`"
   * (`model/theme.ts`), so retuning the canvas default re-flows every
   * section that never set its own. `| undefined` for the same
   * `exactOptionalPropertyTypes` reason as `textColor` below.
   */
  padding?: SectionPadding | undefined
  /**
   * Horizontal padding of the content column, in px. Absent means
   * "inherit the theme's `sectionPaddingX`", exactly as `padding` above
   * inherits `sectionPadding`. A plain number (no named stops in the
   * stored value): the Style popover's control snaps to
   * `SECTION_PADDING_X_PX` for display, and the renderer caps the value
   * on a narrow container (`render/section-style.ts`).
   */
  paddingX?: number | undefined
  /**
   * One colour for every text node in the section (white over a photo).
   * The `| undefined` (not just the `?`) is deliberate: the section bar's
   * "Use page colour" control clears this by dispatching an explicit
   * `undefined` patch value (the reducer merges patches with a plain
   * spread, so there is no other way to remove a key), which
   * `exactOptionalPropertyTypes` rejects unless the property's own type
   * admits `undefined`. Mirrors `Section.content` below for the same reason.
   */
  textColor?: string | undefined
  /** Default alignment for the section's text. */
  align?: 'left' | 'center' | 'right'
  /**
   * Vertical placement of the section's content within the section box.
   * Only visible when the section has extra vertical space (e.g. `height:
   * 'full'`); defaults to `'middle'`, matching the pre-existing hardcoded
   * behaviour.
   */
  verticalAlign?: 'top' | 'middle' | 'bottom'
}

/**
 * Data carried by the six data kinds. Phase 1 keeps the v1 block fields
 * (minus the `BaseBlock` chrome) so the existing public components can
 * render them through an adapter; Phase 3 replaces these with v2 shapes.
 */
type V1Data<B> = Omit<B, 'id' | 'type' | 'locked' | 'hidden' | 'sectionBackground'>
/**
 * The v1 blocks' own text-above/text-below fields, which a v2 data section
 * does not carry (2026-09-19 feedback: "remove the text from all these
 * sections... we can always add text sections around them"). A heading,
 * caption or reassurance line is its own `content` section stacked
 * above/below the data, never embedded in it. Omitted from every data
 * type so no editor can read or write them; `render/data-section.tsx`
 * blanks them at runtime too, for a layout saved before this rule.
 */
export const DATA_TEXT_FIELDS = ['heading', 'headingStyle', 'caption', 'captionStyle', 'textBelow', 'textBelowStyle', 'reassurance'] as const
type NoText<B> = Omit<B, (typeof DATA_TEXT_FIELDS)[number]>
/**
 * The packages section: the v1 block's display fields (layout,
 * inclusions, CTA label) plus `options`, the packages the template authors
 * itself (`./packages.ts`). `options` absent means a template saved before
 * packages lived in the block; every surface then renders
 * `starterPackages()` (`resolvePackageOptions`) and the editor commits
 * them on the first edit.
 */
export type PackagesData = NoText<V1Data<PackagesBlock>> & { options?: PackageOption[] }
export type GalleryData = V1Data<GalleryBlock>
export type VideoData = NoText<V1Data<VideoBlock>>
export type TestimonialsData = NoText<V1Data<TestimonialsBlock>>
export type FaqData = NoText<V1Data<FaqBlock>>
export type AcceptData = NoText<V1Data<AcceptBlock>>

/** Discriminated union of data content for each data section kind. */
export type SectionData =
  | { kind: 'packages'; packages: PackagesData }
  | { kind: 'gallery'; gallery: GalleryData }
  | { kind: 'video'; video: VideoData }
  | { kind: 'testimonials'; testimonials: TestimonialsData }
  | { kind: 'faq'; faq: FaqData }
  | { kind: 'accept'; accept: AcceptData }

/** A single section within a proposal: rich content, data, or a bare page break (`kind: 'pageBreak'`, which carries only `id` and the schema-required `style`). */
export interface Section {
  /** Unique identifier for the section. */
  id: string
  kind: SectionKind
  /** Shown in the section bar and the section nav; derived from the first heading when absent. */
  name?: string
  /** Visual styling for the section. */
  style: SectionStyle
  /** Hide this section on mobile viewports. */
  hideOnMobile?: boolean
  /** Data kinds only: heading + line above the data. */
  intro?: RichDoc
  /** Kind `content` only. */
  content?: RichDoc | undefined
  /** Data kinds only. */
  data?: SectionData
}

/** Configuration for public proposal page behavior and appearance. */
export interface PageSettings {
  /** Bcrypt hash at rest; `null` = no password. Never the plaintext. */
  passwordHash?: string | null
  /** Allow visitors to download the proposal as PDF. */
  allowDownload?: boolean
  /** OpenGraph preview metadata (title and image URL). */
  linkPreview?: { title?: string; imageUrl?: string }
  /** Show a navigation sidebar with section anchors. */
  sectionNav?: boolean
  /** Proposal expires after this many days from creation. */
  expiryDays?: number
  /** Deposit amount as a percentage of the total (0-100). */
  depositPercent?: number
}

/** Root structure of a proposal: sections, canvas theme, and page configuration. */
export interface ProposalLayout {
  version: 2
  sections: Section[]
  /**
   * Canvas-level styling (`model/theme.ts`). Optional only for layouts
   * saved before themes existed: the editor and every renderer resolve a
   * missing one to `defaultTheme(branding)` via `resolveTheme`, and the
   * editor writes the resolved theme back on its first save.
   */
  theme?: ProposalTheme | undefined
  page?: PageSettings
}
