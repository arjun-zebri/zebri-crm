import type { HeadingFont, BodyFont, FontWeight } from '@/lib/branding/fonts'

export type TextAlign = 'left' | 'center' | 'right'

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
  | 'headerBanner'
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
  | 'proposalBody'
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
}

export interface TaglineBlock extends BaseBlock {
  type: 'tagline'
  textStyle?: TextStyle
}

export interface TitleBlock extends BaseBlock {
  type: 'title'
  title: string
  subtitle: string
  showRef: boolean
  showExpires: boolean
  showAbn: boolean
  titleStyle?: TextStyle
  subtitleStyle?: TextStyle
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
  heading: string
  accountName: string
  bsb: string
  accountNumber: string
  headingStyle?: TextStyle
  labelStyle?: TextStyle
  valueStyle?: TextStyle
}

export interface TextBlock extends BaseBlock {
  type: 'text'
  text: string
  textStyle?: TextStyle
}

export interface ActionBlock extends BaseBlock {
  type: 'action'
  primary: string
  secondary: string | null
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
  /** Optional final line of copy (e.g. "Thank you for choosing us"). */
  closingNote?: string
  noteStyle?: TextStyle
  contactStyle?: TextStyle
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
  | VendorTimelineBodyBlock
  | QuestionnaireBodyBlock
  | ImageBlock
  | SpacerBlock

export type BlocksByDoc = Record<'proposal' | 'invoice' | 'contract' | 'portal' | 'vendorTimeline' | 'questionnaire', Block[]>

export const BLOCK_LABELS: Record<BlockType, string> = {
  headerBanner: 'Header banner',
  businessName: 'My details',
  tagline: 'Tagline',
  title: 'Title & meta',
  lineItems: 'Line items',
  totals: 'Totals',
  paymentDetails: 'Payment details',
  text: 'Text',
  action: 'Action',
  divider: 'Divider',
  footer: 'Footer',
  couplePortal: 'Couple portal',
  paymentSchedule: 'Payment schedule',
  contractBody: 'Contract body',
  proposalBody: 'Proposal',
  vendorTimelineBody: 'Run sheet',
  questionnaireBody: 'Questionnaire',
  image: 'Image',
  spacer: 'Spacer',
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
  paymentSchedule: 'Deposit & final balance (live invoice data)',
  contractBody: 'The contract body (fixed — edited per couple)',
  proposalBody: 'Packages, chooser and accept (fixed)',
  vendorTimelineBody: 'The vendor run sheet (live timeline data)',
  questionnaireBody: 'The questionnaire steps (fixed)',
  image: 'An uploaded image',
  spacer: 'Adjustable vertical gap',
}
