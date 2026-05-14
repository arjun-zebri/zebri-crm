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
}

export type BlockType =
  | 'headerBanner'
  | 'businessName'
  | 'tagline'
  | 'title'
  | 'lineItems'
  | 'totals'
  | 'text'
  | 'action'
  | 'divider'
  | 'footer'

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
}

export interface BusinessNameBlock extends BaseBlock {
  type: 'businessName'
  nameStyle?: TextStyle
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
}

export interface TotalsBlock extends BaseBlock {
  type: 'totals'
  taxRate: number
  showSubtotal: boolean
  totalStyle?: TextStyle
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
}

export interface DividerBlock extends BaseBlock {
  type: 'divider'
  thickness?: number
  color?: string
}

export interface FooterBlock extends BaseBlock {
  type: 'footer'
  /** Optional final line of copy (e.g. "Thank you for choosing us"). */
  closingNote?: string
  /** Show the small Zebri-style mark + business name on the left. */
  showMark?: boolean
  noteStyle?: TextStyle
  contactStyle?: TextStyle
}

export type Block =
  | HeaderBannerBlock
  | BusinessNameBlock
  | TaglineBlock
  | TitleBlock
  | LineItemsBlock
  | TotalsBlock
  | TextBlock
  | ActionBlock
  | DividerBlock
  | FooterBlock

export type BlocksByDoc = Record<'quote' | 'invoice' | 'contract', Block[]>

export const BLOCK_LABELS: Record<BlockType, string> = {
  headerBanner: 'Header banner',
  businessName: 'Business name',
  tagline: 'Tagline',
  title: 'Title & meta',
  lineItems: 'Line items',
  totals: 'Totals',
  text: 'Text',
  action: 'Action',
  divider: 'Divider',
  footer: 'Footer',
}

export const BLOCK_DESCRIPTIONS: Record<BlockType, string> = {
  headerBanner: 'Full-width banner image',
  businessName: 'Logo and business name',
  tagline: 'Tagline text below the name',
  title: 'Document title and reference',
  lineItems: 'Services and amounts',
  totals: 'Subtotal, tax, total',
  text: 'Plain paragraph or note',
  action: 'Accept / Decline / Pay',
  divider: 'Horizontal rule',
  footer: 'Business contact and closing line',
}
