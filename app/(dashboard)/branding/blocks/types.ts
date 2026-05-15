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
  /** Explicit minimum height (px) set by dragging the resize handle. */
  blockHeightPx?: number
  /** Vertical alignment of content when blockHeightPx creates extra space. Defaults to 'middle'. */
  blockVAlign?: 'top' | 'middle' | 'bottom'
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

export type BusinessNameLayout = 'row' | 'stacked' | 'logo' | 'name'

export interface BusinessNameBlock extends BaseBlock {
  type: 'businessName'
  nameStyle?: TextStyle
  /** Composition layout. Defaults to 'row' (mark on left, name on right). */
  layout?: BusinessNameLayout
  /** Pixel height of the logo / monogram. Defaults to 48. */
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
}

export interface DividerBlock extends BaseBlock {
  type: 'divider'
  thickness?: number
  color?: string
  lineStyle?: 'solid' | 'dashed' | 'dotted'
}

export interface FooterBlock extends BaseBlock {
  type: 'footer'
  /** Optional final line of copy (e.g. "Thank you for choosing us"). */
  closingNote?: string
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
  businessName: 'My details',
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
