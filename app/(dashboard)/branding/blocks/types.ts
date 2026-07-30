import type { JSONContent } from '@tiptap/core'

import type { HeadingFont, BodyFont, FontWeight } from '@/lib/branding/fonts'

export type TextAlign = 'left' | 'center' | 'right'

/**
 * A rich-text field value. New content is TipTap {@link JSONContent}; a plain
 * string is tolerated for legacy/pre-migration data, which `migrateBlocks`
 * upgrades and the public renderer escapes.
 */
export type RichTextValue = JSONContent | string

export interface TextStyle {
  fontFamily?: HeadingFont | BodyFont
  fontSize?: number       // px
  fontWeight?: FontWeight
  color?: string
  align?: TextAlign
  lineHeight?: number     // unitless
  letterSpacing?: number  // em
  italic?: boolean
  underline?: boolean
  /** Text transformation. 'sentence' capitalises the first letter only (no CSS
   *  equivalent — applied as a string transform at render time). Defaults to 'none'. */
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize' | 'sentence'
}

export type BlockType =
  | 'headerBanner'        // deprecated: migrated to image; kept for repair
  | 'businessName'
  | 'tagline'
  | 'title'
  | 'lineItems'
  | 'totals'
  | 'paymentDetails'
  | 'text'
  | 'action'
  | 'divider'
  | 'footer'
  | 'couplePortal'
  | 'paymentSchedule'
  | 'contractBody'
  | 'proposalBody'        // deprecated: decomposed into the four package blocks; kept for repair
  | 'packageHeader'
  | 'packageDetails'
  | 'packageLineItems'
  | 'packageInclusions'
  | 'packageTotals'
  | 'vendorTimelineBody'
  | 'questionnaireBody'
  | 'image'
  | 'spacer'

export interface BaseBlock {
  id: string
  type: BlockType
  locked?: boolean
  hidden?: boolean
  /** Optional outer border. When 0 or undefined, no border is rendered. */
  borderWidth?: number
  /** Border colour — defaults to the brand's muted/separator if omitted. */
  borderColor?: string
  /** Override the block's corner radius. Falls back to global cornerRadius. */
  blockRadius?: number
  /** Explicit minimum height (px) set by dragging the resize handle. */
  blockHeightPx?: number
  /** Vertical alignment of content when blockHeightPx creates extra space. Defaults to 'middle'. */
  blockVAlign?: 'top' | 'middle' | 'bottom'
  /** Padding top in pixels. */
  padTop?: number
  /** Padding right in pixels. */
  padRight?: number
  /** Padding bottom in pixels. */
  padBottom?: number
  /** Padding left in pixels. */
  padLeft?: number
  /** Background color for this block. */
  bgColor?: string
  /** Maximum width in pixels. When set, content is constrained to this width. */
  maxWidthPx?: number
  /** Horizontal alignment. left | center | right. */
  align?: 'left' | 'center' | 'right'
  /** Vertical margin above the block in pixels. */
  spaceAbove?: number
  /** Vertical margin below the block in pixels. */
  spaceBelow?: number
}

export interface HeaderBannerBlock extends BaseBlock {
  type: 'headerBanner'
  height?: 'sm' | 'md' | 'lg'
  heightPx?: number
  fit?: 'cover' | 'contain'
  imageX?: number
  imageY?: number
  /** Image zoom factor, 1–4. Anchored at imageX/imageY so panning sets the zoom focus. */
  imageScale?: number
  /** Optional overlay colour applied over the banner image. */
  overlayColor?: string
  /** Overlay opacity, 0–1. Only used when overlayColor is set. */
  overlayOpacity?: number
}

export type BusinessNameLayout = 'row' | 'stacked' | 'logo' | 'name'

export interface BusinessNameBlock extends BaseBlock {
  type: 'businessName'
  nameStyle?: TextStyle
  /** Composition layout. Defaults to 'row' (mark on left, name on right). */
  layout?: BusinessNameLayout
  /** Pixel height of the logo / monogram. Defaults to 40, capped at 3.5x width. */
  logoHeightPx?: number
  /**
   * Block-local business name override. When set, this block renders this name
   * instead of the global brand name (`branding.business_name`), and editing the
   * name inline writes here — never the shared brand field. Undefined means the
   * block inherits the global brand name (the default for an untouched block).
   */
  name?: string
}

export interface TaglineBlock extends BaseBlock {
  type: 'tagline'
  textStyle?: TextStyle
}

export interface TitleBlock extends BaseBlock {
  type: 'title'
  title: string
  /**
   * @deprecated Free-text subtitle. Replaced by the auto couple-name line
   * (`showCoupleName`), which pulls the couple's real name from document data
   * so nothing editable can render placeholder text on a sent document. Kept
   * on the type only so existing saved blocks migrate cleanly; not rendered.
   */
  subtitle?: string
  /**
   * Show the couple's name as the subtitle line. The value is sourced from the
   * document (`PublicDocData.coupleName`), not editable in the block, and is
   * toggled via the title toolbar's Include dropdown.
   */
  showCoupleName?: boolean
  showRef: boolean
  showExpires: boolean
  showAbn: boolean
  titleStyle?: TextStyle
  /** Styling for the couple-name subtitle line. Targeted by clicking the couple
   *  name in the preview; falls back to the global subtitle role. */
  subtitleStyle?: TextStyle
  /** Styling for the meta row (reference / due-or-expiry date / ABN). Targeted by
   *  clicking the meta row in the preview; falls back to the global roles. */
  metaStyle?: TextStyle
}

export interface LineItemsBlock extends BaseBlock {
  type: 'lineItems'
  showHeader?: boolean
  rowStyle?: 'lines' | 'stripes' | 'plain'
  headerStyle?: TextStyle
  itemStyle?: TextStyle
  /** When true, description is left and amount is right (justify-between). Default false = both columns share the same alignment. */
  colSpread?: boolean
}

export interface TotalsBlock extends BaseBlock {
  type: 'totals'
  taxRate: number
  showSubtotal: boolean
  showTax?: boolean
  colSpread?: boolean
  subtotalStyle?: TextStyle
  taxStyle?: TextStyle
  totalStyle?: TextStyle
}

export interface PaymentDetailsBlock extends BaseBlock {
  type: 'paymentDetails'
  /** Section heading (rich text). */
  heading: RichTextValue
  accountName: string
  bsb: string
  accountNumber: string
  /** Editable instruction shown under the heading (e.g. "Please transfer the
   *  total to the account below"). Empty = not shown on the sent document. */
  note?: string
  headingStyle?: TextStyle
  labelStyle?: TextStyle
  valueStyle?: TextStyle
  /** Styling for the instruction note. */
  noteStyle?: TextStyle
}

export interface TextBlock extends BaseBlock {
  type: 'text'
  /** Rich-text content (TipTap JSON; legacy string tolerated during migration). */
  text: RichTextValue
  textStyle?: TextStyle
}

export interface ActionBlock extends BaseBlock {
  type: 'action'
  primary: string
  secondary: string | null
  /** Editable instruction shown above the button(s) (e.g. "Pay securely online
   *  with your card"). Empty = not shown on the sent document. */
  note?: string
  noteStyle?: TextStyle
  primaryStyle?: TextStyle
  secondaryStyle?: TextStyle
  buttonColor?: string
  buttonRadius?: number
  /** Explicit width of primary button in px. When undefined, primary fills available space (flex-1). */
  primaryWidthPx?: number
  /** Explicit width of secondary button in px. When undefined, secondary sizes to content. */
  secondaryWidthPx?: number
  /** Vertical padding of primary button (px). Default 14. */
  primaryPaddingY?: number
  /** Vertical padding of secondary button (px). Default 14. */
  secondaryPaddingY?: number
  /** Horizontal alignment of the button group within the block. Default 'center'. */
  buttonJustify?: 'start' | 'center' | 'end'
  /** Block-level override for the secondary button background. Falls back to brand secondaryColor. */
  secondaryColor?: string
  /** Button style variant: 'fill' (solid background) or 'outline' (border + transparent). Defaults to global button_variant. */
  variant?: 'fill' | 'outline'
  /** Button size preset: 'sm', 'md', or 'lg'. Defaults to global button_size. */
  size?: 'sm' | 'md' | 'lg'
}

export interface DividerBlock extends BaseBlock {
  type: 'divider'
  thickness?: number
  color?: string
  lineStyle?: 'solid' | 'dashed' | 'dotted'
  /** Width as a percentage of container, 1–100. Defaults to 100 (full width). */
  widthPct?: number
}

export interface FooterBlock extends BaseBlock {
  type: 'footer'
  /** Optional final line of copy (e.g. "Thank you for choosing us"). Rich text. */
  closingNote?: RichTextValue
  noteStyle?: TextStyle
  contactStyle?: TextStyle
  /**
   * @deprecated The business name was removed from the footer contact line (it
   * duplicated the My-details block). Kept on the type so saved blocks migrate
   * cleanly; no longer rendered or toggleable.
   */
  showBusinessName?: boolean
  /** Show the phone number in the contact line. Defaults to shown. */
  showPhone?: boolean
  /** Show the website in the contact line. Defaults to shown. */
  showContactWebsite?: boolean
  /** Show the ABN in the contact line. Defaults to shown. */
  showAbn?: boolean
  /** Vertical gap (px) between the closing note and the contact/social block. Defaults to 12. */
  noteGap?: number
  /** Show Facebook social icon when URL is present. */
  showFacebook?: boolean
  /** Show Instagram social icon when URL is present. */
  showInstagram?: boolean
  /** Show Twitter social icon when URL is present. */
  showTwitter?: boolean
  /** Show Pinterest social icon when URL is present. */
  showPinterest?: boolean
  /** Horizontal gap (px) between social icons. Defaults to 12. */
  socialGap?: number
  /** Colour of the social icons. Undefined = the muted body colour (the default). */
  socialIconColor?: string
  /** Background colour of the chip behind each social icon. Undefined = no chip
   *  (plain icon, the default). */
  socialIconBg?: string
  /** Corner radius (px) of the social icon chip. Defaults to 8. Only applies when
   *  socialIconBg is set. */
  socialIconRadius?: number
}

/**
 * Image block — allows uploading and positioning an image with pan/zoom/fit controls.
 * Each image block has a unique storage key derived from its block ID to prevent overwrites.
 */
export interface ImageBlock extends BaseBlock {
  type: 'image'
  /** Public URL of the uploaded image. */
  url?: string
  /** Object fit: 'cover' fills the space, 'contain' fits the whole image. Defaults to 'cover'. */
  fit?: 'cover' | 'contain'
  /** Horizontal position of the image within its container (0-100%). Defaults to 50. */
  imageX?: number
  /** Vertical position of the image within its container (0-100%). Defaults to 50. */
  imageY?: number
  /** Image zoom factor (1-4). Defaults to 1. Anchored at imageX/imageY. */
  imageScale?: number
  /** Explicit height of the image block in pixels. */
  heightPx?: number
}

/**
 * Spacer block — renders an adjustable vertical gap between content blocks.
 * Useful for controlling document flow and whitespace.
 */
export interface SpacerBlock extends BaseBlock {
  type: 'spacer'
  /** Height of the spacer in pixels. Defaults to 32. */
  heightPx?: number
}

export interface CouplePortalBlock extends BaseBlock {
  type: 'couplePortal'
}

export interface PaymentScheduleBlock extends BaseBlock {
  type: 'paymentSchedule'
  /** Editable subheading shown above the schedule. Defaults to "Payment schedule". */
  heading?: string
  /** Styling for the subheading (targeted by clicking it in the preview). */
  headingStyle?: TextStyle
  /** Styling for the stage line labels (targeted by clicking a line in the preview). */
  lineStyle?: TextStyle
  /** Styling for the amount + due-date values (targeted by clicking either in the
   *  preview). */
  valueStyle?: TextStyle
}

/**
 * Marker block — represents the position where the per-couple
 * contract body (TipTap content written in the builder modal)
 * will appear. The MC can drag chrome blocks above and below it
 * in the branding editor; the contract content itself is never
 * editable on the branding surface. Same model as `couplePortal`
 * and `paymentSchedule`.
 */
export interface ContractBodyBlock extends BaseBlock {
  type: 'contractBody'
}

/**
 * Marker block — the fixed proposal core (the package chooser, the
 * chosen option's priced detail, the accept block). Its STRUCTURE +
 * order are fixed (a chooser can't be expressed as blocks), but the
 * MC drags chrome blocks above and below it and can retype its
 * section labels inline. Same model as `couplePortal` /
 * `contractBody`.
 */
export interface ProposalBodyBlock extends BaseBlock {
  type: 'proposalBody'
}

/** Proposal package name + (when several packages were sent) a subtle in-block
 *  "switch package" control. Renders the chosen option's title. */
export interface PackageHeaderBlock extends BaseBlock {
  type: 'packageHeader'
  titleStyle?: TextStyle
}

/** Proposal package description / marketing copy for the chosen option. */
export interface PackageDetailsBlock extends BaseBlock {
  type: 'packageDetails'
  bodyStyle?: TextStyle
}

/** Optional add-on inclusions for the chosen option, as couple-toggleable rows. */
export interface PackageInclusionsBlock extends BaseBlock {
  type: 'packageInclusions'
  headingStyle?: TextStyle
  itemStyle?: TextStyle
}

/** The package's included (base) services, displayed as styled line items. */
export interface PackageLineItemsBlock extends BaseBlock {
  type: 'packageLineItems'
  showHeader?: boolean
  /** Editable section heading. Defaults to "Included services". */
  heading?: string
  rowStyle?: 'lines' | 'stripes' | 'plain'
  headerStyle?: TextStyle
  itemStyle?: TextStyle
  colSpread?: boolean
}

/** Live-recalculating price summary (subtotal, GST, total) for the chosen
 *  option + current add-on selection. */
export interface PackageTotalsBlock extends BaseBlock {
  type: 'packageTotals'
  subtotalStyle?: TextStyle
  totalStyle?: TextStyle
}

/**
 * Marker block represents the position where the vendor run sheet
 * (live timeline data) will appear. The MC can drag chrome blocks above
 * and below it in the branding editor; the run sheet content itself is
 * never editable on the branding surface. Same model as `couplePortal`,
 * `paymentSchedule`, and `contractBody`.
 */
export interface VendorTimelineBodyBlock extends BaseBlock {
  type: 'vendorTimelineBody'
}

/**
 * Marker block represents the position where the questionnaire steps
 * (fixed content) will appear. The MC can drag chrome blocks above and
 * below it in the branding editor; the questionnaire itself is never
 * editable on the branding surface. Same model as `couplePortal`,
 * `paymentSchedule`, and `contractBody`.
 */
export interface QuestionnaireBodyBlock extends BaseBlock {
  type: 'questionnaireBody'
  /** Presentation mode for the couple-facing questionnaire. 'form' shows all
   *  questions on one page; 'oneAtATime' is Typeform-style one-per-step.
   *  Defaults to 'form' when absent. */
  mode?: 'form' | 'oneAtATime'
}

export type Block =
  | HeaderBannerBlock
  | BusinessNameBlock
  | TaglineBlock
  | TitleBlock
  | LineItemsBlock
  | TotalsBlock
  | PaymentDetailsBlock
  | TextBlock
  | ActionBlock
  | DividerBlock
  | FooterBlock
  | CouplePortalBlock
  | PaymentScheduleBlock
  | ContractBodyBlock
  | ProposalBodyBlock
  | PackageHeaderBlock
  | PackageDetailsBlock
  | PackageLineItemsBlock
  | PackageInclusionsBlock
  | PackageTotalsBlock
  | VendorTimelineBodyBlock
  | QuestionnaireBodyBlock
  | ImageBlock
  | SpacerBlock

export type BlocksByDoc = Record<'proposal' | 'invoice' | 'contract' | 'portal' | 'vendorTimeline' | 'questionnaire', Block[]>

export const BLOCK_LABELS: Record<BlockType, string> = {
  headerBanner: 'Header banner',
  businessName: 'My details',
  tagline: 'Tagline',
  title: 'Invoice header',
  lineItems: 'Line items',
  totals: 'Totals',
  paymentDetails: 'Bank transfer',
  text: 'Text',
  action: 'Pay with card',
  divider: 'Divider',
  footer: 'Footer',
  couplePortal: 'Couple portal',
  paymentSchedule: 'Payment schedule',
  contractBody: 'Contract body',
  proposalBody: 'Proposal',
  packageHeader: 'Package header',
  packageDetails: 'Package details',
  packageLineItems: 'Package line items',
  packageInclusions: 'Package optional inclusions',
  packageTotals: 'Package totals',
  vendorTimelineBody: 'Run sheet',
  questionnaireBody: 'Questionnaire',
  image: 'Image',
  spacer: 'Spacer',
}

/**
 * Surface-specific overrides for {@link BLOCK_LABELS}. The action block is a
 * payment CTA on invoices ("Pay with card") but an accept/decline CTA on
 * proposals ("Accept proposal"), so its label depends on the document.
 */
const BLOCK_LABEL_OVERRIDES: Record<string, Partial<Record<BlockType, string>>> = {
  proposal: { action: 'Accept proposal' },
  contract: { title: 'Contract header', action: 'Sign contract' },
}

/**
 * Human label for a block type, specialised per surface where it differs, else
 * the surface-agnostic {@link BLOCK_LABELS} entry.
 *
 * @param type - The block type.
 * @param surface - The document surface (e.g. 'proposal', 'invoice'); optional.
 */
export function blockLabel(type: BlockType, surface?: string): string {
  return (surface ? BLOCK_LABEL_OVERRIDES[surface]?.[type] : undefined) ?? BLOCK_LABELS[type]
}

export const BLOCK_DESCRIPTIONS: Record<BlockType, string> = {
  headerBanner: 'Full-width banner image',
  businessName: 'Logo and business name',
  tagline: 'Tagline text below the name',
  title: 'Document title and reference',
  lineItems: 'Services and amounts',
  totals: 'Subtotal, tax, total',
  paymentDetails: 'Bank transfer account details',
  text: 'Plain paragraph or note',
  action: 'Accept / Decline / Pay',
  divider: 'Horizontal rule',
  footer: 'Business contact and closing line',
  couplePortal: 'The couple-facing portal (fixed)',
  paymentSchedule: 'Payment stages (live invoice data)',
  contractBody: 'The contract body (fixed — edited per couple)',
  proposalBody: 'Packages, chooser and accept (fixed)',
  packageHeader: 'Package name and chooser',
  packageDetails: 'Package description',
  packageLineItems: 'The package\'s included services',
  packageInclusions: 'Optional add-ons the couple can toggle',
  packageTotals: 'Subtotal, GST and total',
  vendorTimelineBody: 'The vendor run sheet (live timeline data)',
  questionnaireBody: 'The questionnaire steps (fixed)',
  image: 'An uploaded image',
  spacer: 'Adjustable vertical gap',
}
