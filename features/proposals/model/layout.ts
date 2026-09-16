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

/** A TipTap document. Always normalised with `toPlainJSON` before storage. */
export type RichDoc = JSONContent

/** Kind of section determining its visual rendering and data fields. */
export type SectionKind = 'content' | 'packages' | 'gallery' | 'video' | 'testimonials' | 'faq' | 'accept'

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
}

/** Visual styling for one section: background, height, width, padding and text colour/alignment. */
export interface SectionStyle {
  background?: SectionBackground
  /** `full` pins the section to one screen (`100svh`); the hero case. */
  height: 'fit' | 'full'
  contentWidth: ContentWidth
  padding: SectionPadding
  /** One colour for every text node in the section (white over a photo). */
  textColor?: string
  /** Default alignment for the section's text. */
  align?: 'left' | 'center'
}

/**
 * Data carried by the six data kinds. Phase 1 keeps the v1 block fields
 * (minus the `BaseBlock` chrome) so the existing public components can
 * render them through an adapter; Phase 3 replaces these with v2 shapes.
 */
type V1Data<B> = Omit<B, 'id' | 'type' | 'locked' | 'hidden' | 'sectionBackground'>
export type PackagesData = V1Data<PackagesBlock>
export type GalleryData = V1Data<GalleryBlock>
export type VideoData = V1Data<VideoBlock>
export type TestimonialsData = V1Data<TestimonialsBlock>
export type FaqData = V1Data<FaqBlock>
export type AcceptData = V1Data<AcceptBlock>

/** Discriminated union of data content for each data section kind. */
export type SectionData =
  | { kind: 'packages'; packages: PackagesData }
  | { kind: 'gallery'; gallery: GalleryData }
  | { kind: 'video'; video: VideoData }
  | { kind: 'testimonials'; testimonials: TestimonialsData }
  | { kind: 'faq'; faq: FaqData }
  | { kind: 'accept'; accept: AcceptData }

/** A single section within a proposal, containing either rich content or data. */
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

/** Root structure of a proposal: sections and page configuration. */
export interface ProposalLayout {
  version: 2
  sections: Section[]
  page?: PageSettings
}
