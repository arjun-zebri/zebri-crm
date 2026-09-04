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
  | 'contractSign'          // deprecated: superseded by the three per-party blocks
  | 'contractSignVendor'
  | 'contractSignPrimary'
  | 'contractSignSecondary'
  | 'vendorTimelineBody'
  | 'questionnaireOneAtATime'
  | 'questionnaireAllOnePage'
  | 'image'
  | 'spacer'
  | 'formField'
  | 'formSubmit'

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
  /** Styling for a line item's optional note. Falls back to the fine-print
   *  role, which is what the quantity sub-line already uses. */
  noteStyle?: TextStyle
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
 * Semantic role of a website-form field. Drives the mapping into couple columns
 * when a lead is submitted (see the `submit_lead` RPC). A `custom` field maps to
 * no column: its answer is stored on the submission and copied into couple notes.
 */
export type FormFieldRole =
  | 'name'
  | 'partnerName'
  | 'email'
  | 'phone'
  | 'weddingDate'
  | 'venue'
  | 'message'
  | 'referral'
  | 'custom'

/** The input control a website-form field renders as. */
export type FormFieldInputType = 'text' | 'email' | 'tel' | 'date' | 'textarea' | 'select'

/**
 * Form-field block — one configurable input on the Website form (`lead`) surface.
 * Repeatable: the MC adds one per field they want to collect. The `role` decides
 * how the answer maps to a couple on submit; `inputType` decides the control.
 */
export interface FormFieldBlock extends BaseBlock {
  type: 'formField'
  /** How the answer maps to a couple column (or `custom` for notes-only). */
  role: FormFieldRole
  /** The rendered control. `select` uses {@link options}. */
  inputType: FormFieldInputType
  /** The visible field label. */
  label: string
  /** Optional placeholder text. */
  placeholder?: string
  /** Whether the visitor must fill this field to submit. */
  required: boolean
  /** Choices for a `select` field; ignored for other input types. */
  options?: string[]
}

/**
 * Submit block — the Website form's submit button. Singleton marker per the
 * exactly-one policy (see policy.EXACTLY_ONE_BY_SURFACE): the live button is
 * injected on the public page at this marker's position.
 */
export interface FormSubmitBlock extends BaseBlock {
  type: 'formSubmit'
  /** Button label, e.g. "Send enquiry". */
  label: string
  /** Message shown after a successful submit (successMode 'message'). */
  successMessage: string
  /**
   * What happens after a successful submit: show {@link successMessage} in
   * place of the form ('message', the default when absent) or navigate to
   * {@link redirectUrl} ('redirect', for the MC's own thank-you page, e.g.
   * for ad conversion tracking).
   */
  successMode?: 'message' | 'redirect'
  /**
   * Destination for successMode 'redirect'. Only http(s) URLs are honoured
   * on the public page (see successRedirectUrl in lib/lead-capture); anything
   * else falls back to showing {@link successMessage}.
   */
  redirectUrl?: string
  /** Button fill (label colour on 'outline'). Falls back to brand colour. */
  buttonColor?: string
  /** Button corner radius (px). Falls back to the brand corner radius. */
  buttonRadius?: number
  /** 'fill' (solid) or 'outline'. Falls back to the global button variant. */
  variant?: 'fill' | 'outline'
  /** Size preset (padding + font size). Falls back to the global button size. */
  size?: 'sm' | 'md' | 'lg'
  /** Horizontal alignment of the button within the block. Default 'start'. */
  buttonJustify?: 'start' | 'center' | 'end'
  /** Explicit button width (px). When undefined, the button sizes to its label.
   *  Explicitly settable to undefined so the width slider's zero position can
   *  clear the override under exactOptionalPropertyTypes. */
  widthPx?: number | undefined
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
/**
 * @deprecated Superseded by the three per-party signature blocks
 * ({@link ContractSignVendorBlock}, {@link ContractSignPrimaryBlock},
 * {@link ContractSignSecondaryBlock}), which let the MC place and style each
 * party's signature independently.
 *
 * Kept on the type, in the palette policy's marker sets, and rendered by the
 * public card because block trees are NOT snapshotted per contract: a contract
 * sent months ago still renders through the MC's live tree. An MC who has not
 * opted into the split keeps this block, and it must keep working.
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
 * Shared shape for the three per-party signature marker blocks.
 *
 * The single `contractSign` block stacked three things in a fixed order: the
 * supplier's countersignature, the roster of who had signed, and the live
 * sign form. Splitting it per party lets the MC place each signature where it
 * belongs on their document (side by side, at the foot of a clause, after a
 * schedule) and style each one, which is what a signature page normally looks
 * like.
 *
 * Which party a block represents is its `type`. Each renders that party's own
 * panel (role label, signature, name, date, and awaiting/declined state) and
 * nothing at all when the contract has no such party, so a solo-signatory
 * contract simply does not show a second-partner slot.
 *
 * The live sign form renders inside whichever block belongs to the person
 * viewing the link. The form's BEHAVIOUR is never configurable here — only its
 * labels, button colour and typography.
 */
interface ContractSignPartyBlockBase extends BaseBlock {
  /** Prompt heading above this party's panel (e.g. "Sign to accept"). */
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
  /** Typography override for the rendered signature itself (the cursive line). */
  signatureStyle?: TextStyle
  /** Show the date beneath the signature. Defaults to shown. */
  showDate?: boolean
}

/**
 * The supplier's own signature (the MC / celebrant / DJ). Filled at send time
 * from their Settings signature, so it is already signed when the couple opens
 * the document.
 */
export interface ContractSignVendorBlock extends ContractSignPartyBlockBase {
  type: 'contractSignVendor'
}

/** The primary contact's signature (client signer at `signing_order` 1). */
export interface ContractSignPrimaryBlock extends ContractSignPartyBlockBase {
  type: 'contractSignPrimary'
}

/**
 * The secondary contact's signature (client signer at `signing_order` 2).
 * Renders nothing when the couple has only one named contact.
 */
export interface ContractSignSecondaryBlock extends ContractSignPartyBlockBase {
  type: 'contractSignSecondary'
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
 * Shared shape for the two questionnaire form-style marker blocks. The questions
 * themselves are fixed (couples answer them; the MC never edits them here). The
 * MC controls the block frame (background, padding, border, radius — via
 * {@link BaseBlock}) plus the questions' typography, which is applied on both the
 * editor preview and the live fill page.
 *
 * Every typography field is optional and only carries the properties the MC
 * changed; each falls back to the global questionnaire theme role, so an unstyled
 * block renders exactly like a questionnaire sent before this feature existed.
 */
interface QuestionnaireFormBlockBase extends BaseBlock {
  /** Question heading typography (the per-question prompt). Falls back to the
   *  section-heading role. */
  questionStyle?: TextStyle
  /** Answer typography (input text, choice/option labels). Falls back to the
   *  body role. */
  answerStyle?: TextStyle
  /** Background colour of the Submit / Next / Start button. Absent ⇒ the brand
   *  colour. */
  buttonColor?: string
}

/**
 * Marker block — the position where the couple-facing questionnaire renders as
 * a Typeform-style one-question-at-a-time flow.
 *
 * The form style is chosen by which of the two questionnaire blocks is present:
 * this one, or {@link QuestionnaireAllOnePageBlock}. Exactly one should exist —
 * the readiness engine warns on none or both (see lib/branding/readiness.ts).
 */
export interface QuestionnaireOneAtATimeBlock extends QuestionnaireFormBlockBase {
  type: 'questionnaireOneAtATime'
}

/**
 * Marker block — the position where the couple-facing questionnaire renders as
 * a classic form (all questions on one page). Sibling of
 * {@link QuestionnaireOneAtATimeBlock}; see it for the shared model and the
 * exactly-one selection rule.
 */
export interface QuestionnaireAllOnePageBlock extends QuestionnaireFormBlockBase {
  type: 'questionnaireAllOnePage'
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
  | ContractSignVendorBlock
  | ContractSignPrimaryBlock
  | ContractSignSecondaryBlock
  | VendorTimelineBodyBlock
  | QuestionnaireOneAtATimeBlock
  | QuestionnaireAllOnePageBlock
  | ImageBlock
  | SpacerBlock
  | FormFieldBlock
  | FormSubmitBlock

export type BlocksByDoc = Record<'invoice' | 'contract' | 'portal' | 'vendorTimeline' | 'questionnaire' | 'lead', Block[]>

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
  contractSignVendor: 'Your signature',
  contractSignPrimary: 'Primary contact signature',
  contractSignSecondary: 'Secondary contact signature',
  vendorTimelineBody: 'Run sheet',
  questionnaireOneAtATime: 'One at a time',
  questionnaireAllOnePage: 'All on one page',
  image: 'Image',
  spacer: 'Spacer',
  formField: 'Form field',
  formSubmit: 'Submit button',
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

/**
 * Display name for a block INSTANCE (vs {@link blockLabel}'s per-type name).
 * A `formField` is named by its question ("Your name", "Wedding date") so the
 * selection toolbar and other chrome speak the same language as the palette's
 * ready-made question entries; every other block uses its type label.
 */
export function blockDisplayName(block: Block, surface?: string): string {
  if (block.type === 'formField' && block.label.trim() !== '') return block.label
  return blockLabel(block.type, surface)
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
  contractSignVendor: 'Where you sign the agreement',
  contractSignPrimary: 'Where the primary contact signs',
  contractSignSecondary: 'Where the second contact signs (hidden if there is none)',
  vendorTimelineBody: 'The vendor run sheet (live timeline data)',
  questionnaireOneAtATime: 'Questions one at a time (Typeform-style)',
  questionnaireAllOnePage: 'All questions on one page',
  image: 'An uploaded image',
  spacer: 'Adjustable vertical gap',
  formField: 'A labelled input field',
  formSubmit: 'The submit button',
}
