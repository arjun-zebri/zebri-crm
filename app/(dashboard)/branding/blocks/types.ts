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
  | 'contractSign'
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

/**
 * Marker block — the position where the couple-facing portal (hero + section
 * nav) renders on the public portal page. The MC can drag chrome blocks above
 * and below it in the branding editor; the portal's structure is never editable
 * here (couples fill it in themselves). Same model as `contractBody`,
 * `vendorTimelineBody`, and `paymentSchedule`.
 *
 * Typography overrides are **portal-scoped**: they live on this block, so they
 * never touch invoices, quotes, or contracts. Each is fully optional and only
 * carries the individual properties the MC explicitly changed. The public hero
 * (`app/portal/[token]/page.tsx`) and `PortalShell` resolve each element as
 * `resolveTextStyle(override, defaultsBuiltFromTheValuesTheyCurrentlyHard-code)`,
 * so a portal with none of these set renders byte-identically to every portal
 * sent before this feature existed.
 */
export interface CouplePortalBlock extends BaseBlock {
  type: 'couplePortal'
  /**
   * Title typography override (the hero `<h1>` couple name). Absent ⇒ the title
   * keeps the historical docTitle defaults (text colour). Only set fields apply.
   */
  titleStyle?: TextStyle
  /**
   * Subtitle typography override (the hero intro line). Absent ⇒ the subtitle
   * keeps the historical body defaults (muted/text colour). Only set fields apply.
   */
  subtitleStyle?: TextStyle
  /**
   * Heading typography override, applied to each portal section heading (the
   * `PortalShell` `<h2>`). Absent ⇒ the section heading keeps its historical
   * section-heading-role defaults. Only set fields apply.
   */
  headingStyle?: TextStyle
  /**
   * Body typography override, applied to each portal section subtitle (the
   * `PortalShell` `<p>`). Absent ⇒ the section subtitle keeps its historical
   * body-role defaults. Split from {@link headingStyle} so a section's heading
   * and its subtitle are styled independently.
   */
  bodyStyle?: TextStyle
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
 *
 * Typography overrides are **contract-scoped**: they live on this block, so
 * they never touch invoices or quotes. Each is fully optional and only carries
 * the individual properties the MC explicitly changed. The live prose reads
 * them through CSS variables whose fallbacks equal the historical hard-coded
 * values (see `.contract-content` in `app/globals.css` +
 * `contract-body-section.tsx`), so a block with neither override renders
 * byte-identically to every contract sent before this feature existed.
 */
export interface ContractBodyBlock extends BaseBlock {
  type: 'contractBody'
  /**
   * Paragraph typography override (the `<p>` prose). Absent ⇒ paragraphs keep
   * the historical body defaults. Only the set fields are applied.
   */
  bodyStyle?: TextStyle
  /**
   * Subheading typography override (the `<h1>`/`<h2>`/`<h3>` clause headings).
   * Absent ⇒ subheadings keep the historical heading defaults. A size override
   * collapses all three heading levels to that single size.
   */
  subheadingStyle?: TextStyle
}

/**
 * Marker block — the position where the contract's sign / decline form and the
 * MC countersignature render on the public contract page. Like `contractBody`,
 * the generic renderer emits nothing for it and the public contract card injects
 * the real signing UI at the marker position.
 *
 * The form's behaviour (name input, agreement checkbox, sign / decline calls) is
 * fixed and never editable here — only its labels, button colour and typography
 * are MC-configurable. Every field is optional; each defaults to the historical
 * hard-coded value so an unstyled block renders exactly like the legacy form.
 *
 * Legacy safety: contracts sent before this block existed carry no `contractSign`
 * marker. The public card falls back to injecting the sign UI right after the
 * body (its historical placement), so those contracts stay byte-identical and
 * always signable. `migrateBlocks` therefore never force-adds this marker.
 */
export interface ContractSignBlock extends BaseBlock {
  type: 'contractSign'
  /** Prompt heading above the form (e.g. "Sign to accept"). */
  heading?: string
  /** Label for the primary sign button. Absent ⇒ "Sign contract". */
  primaryLabel?: string
  /** Label for the secondary decline button. Absent ⇒ "Decline". */
  secondaryLabel?: string
  /** Sign-button background colour. Absent ⇒ the brand colour. */
  buttonColor?: string
  /** Typography override for the prompt heading (over the section-heading role). */
  headingStyle?: TextStyle
  /** Typography override for the field / agreement labels (over the body role). */
  labelStyle?: TextStyle
}

/**
 * Marker block represents the position where the vendor run sheet
 * (live timeline data) will appear. The MC can drag chrome blocks above
 * and below it in the branding editor; the run sheet content itself is
 * never editable on the branding surface. Same model as `couplePortal`,
 * `paymentSchedule`, and `contractBody`.
 *
 * Typography overrides are **run-sheet-scoped**: they live on this block, so
 * they never touch invoices, quotes, or contracts. Each is fully optional and
 * only carries the individual properties the MC explicitly changed. Unlike the
 * contract body (which drives its prose through globals.css CSS variables), the
 * run sheet's `VendorTimeline` styles every element with inline styles resolved
 * from the block override layered over the same values it currently hard-codes,
 * so a block with none of these set renders byte-identically to every run sheet
 * sent before this feature existed.
 */
export interface VendorTimelineBodyBlock extends BaseBlock {
  type: 'vendorTimelineBody'
  /**
   * Title typography override (the `<h1>Run Sheet</h1>`). Absent ⇒ the title
   * keeps the historical docTitle defaults. Only the set fields are applied.
   */
  titleStyle?: TextStyle
  /**
   * Subtitle typography override (the date / venue line). Absent ⇒ the subtitle
   * keeps the historical finePrint defaults. Only the set fields are applied.
   */
  subtitleStyle?: TextStyle
  /**
   * Body typography override, applied to the per-item title. Absent ⇒ the item
   * title keeps its historical body-role defaults. Only the set fields are
   * applied, layered over the body role.
   */
  bodyStyle?: TextStyle
  /**
   * Note typography override, applied to the per-item description line. Absent ⇒
   * the description keeps its historical finePrint defaults. Split from
   * {@link bodyStyle} so the item title and its note are styled independently.
   */
  noteStyle?: TextStyle
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
  | ContractSignBlock
  | VendorTimelineBodyBlock
  | QuestionnaireBodyBlock
  | ImageBlock
  | SpacerBlock

export type BlocksByDoc = Record<'invoice' | 'contract' | 'portal' | 'vendorTimeline' | 'questionnaire', Block[]>

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
  contractSign: 'Sign contract',
  vendorTimelineBody: 'Run sheet',
  questionnaireBody: 'Questionnaire',
  image: 'Image',
  spacer: 'Spacer',
}

/**
 * Surface-specific overrides for {@link BLOCK_LABELS}. The shared `title` block
 * is the "Invoice header" on invoices but the "Contract header" on contracts,
 * so its label depends on the document.
 */
const BLOCK_LABEL_OVERRIDES: Record<string, Partial<Record<BlockType, string>>> = {
  contract: { title: 'Contract header' },
}

/**
 * Human label for a block type, specialised per surface where it differs, else
 * the surface-agnostic {@link BLOCK_LABELS} entry.
 *
 * @param type - The block type.
 * @param surface - The document surface (e.g. 'invoice', 'contract'); optional.
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
  contractBody: 'The contract body (fixed, edited per couple)',
  contractSign: 'Signature + sign / decline form (fixed)',
  vendorTimelineBody: 'The vendor run sheet (live timeline data)',
  questionnaireBody: 'The questionnaire steps (fixed)',
  image: 'An uploaded image',
  spacer: 'Adjustable vertical gap',
}
