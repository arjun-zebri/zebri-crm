import type { ProposalLayout, RichDoc, Section, SectionData, SectionKind } from '@/features/proposals';

/**
 * The one document model every Zebri document is built on (2026-10-09):
 * a stack of sections, the same shape as production's proposal layout
 * (`features/proposals/model/layout.ts`), plus the kinds of section only
 * the engine knows (reviews, and in later stages questions, a timeline,
 * line items…) and a lock. The same shape, so production's editor state,
 * undo history and section editors run it unchanged (`as-production.ts`);
 * new kinds never reach production's renderers (`render/doc-section-view.tsx`).
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/model/types
 */

/** Every kind of document the engine builds. */
export type DocType = 'proposal' | 'email' | 'contract' | 'invoice' | 'questionnaire' | 'runSheet' | 'script' | 'custom';

/** One review: what a past client said, who said it, and their stars. */
export interface ReviewItem {
  id: string;
  quote: string;
  /** "Priya & Sam". */
  name: string;
  /** "Married at Stones, 2025"; optional. */
  detail?: string | undefined;
  /** 1 to 5. */
  stars: number;
}

/** The data of each section kind the engine adds to production's. */
export interface EngineDataMap {
  reviews: { items: ReviewItem[]; layout: 'cards' | 'list' };
  /**
   * The top of a document: the brand kit's logo (its own, so it changes
   * everywhere at once) at `height` page pixels, and the MC's words under
   * it, or beside it with `layout: 'beside'`.
   */
  header: { height: number; text?: RichDoc | undefined; layout?: HeaderLayout | undefined };
  /*
   * A document's working parts (`sections/parts/`): drawn from the
   * document's own data (its questions, clauses, lines), never typed on
   * the page, so they hold nothing of their own. Locked in every starter,
   * except a contract's booking details (`agreement`), which may be deleted.
   */
  questions: PartData;
  agreement: PartData;
  clauses: PartData;
  signatures: SignaturesData;
  invoiceHead: PartData;
  lineItems: LineItemsData;
  payment: PartData;
}

/** Where a header's words sit: under the logo (the default) or beside it. */
export type HeaderLayout = 'below' | 'beside';

/**
 * A contract's signing block: who signs (the MC and the couple, or the
 * couple alone), how their places sit, the label over each signer's
 * place (the MC's own words), and whether each place shows the signer's
 * printed name and the date they signed. Unset reads as the MC and the
 * couple, side by side, labelled "The MC" and "The Client", with both lines.
 */
export interface SignaturesData {
  who?: SignatureWho | undefined;
  layout?: SignatureLayout | undefined;
  /** Over the MC's place. */
  yourLabel?: RichDoc | undefined;
  /** Over each of the couple's places. */
  clientLabel?: RichDoc | undefined;
  /** The signer's printed name under the line. */
  name?: boolean | undefined;
  /** The date they signed, under the name. */
  date?: boolean | undefined;
}

/** Who signs a contract: the MC and the couple, or the couple alone. */
export type SignatureWho = 'both' | 'couple';
/** How the signing lines sit: side by side, or one under another. */
export type SignatureLayout = 'row' | 'stack';

/**
 * An invoice's lines and totals: whether the GST is broken out under
 * them (subtotal, then GST), whether each line shows its detail line
 * (both unset read as shown), its lines, and every word in it.
 */
export interface LineItemsData {
  gst?: boolean | undefined;
  detail?: boolean | undefined;
  /** The block's headings and totals' words, each the MC's own (with `@` fields); Zebri's wording when unset. */
  words?: Partial<Record<LineItemsWord, RichDoc>> | undefined;
  /** The lines, in order; this payment's line alone when unset. */
  items?: LineItem[] | undefined;
}

/** The headings and totals' wording in an invoice's lines block. */
export type LineItemsWord = 'description' | 'amount' | 'subtotal' | 'gst' | 'total';

/**
 * One line an invoice charges: what it is (with `@` fields), a quieter
 * line under it, and its amount in dollars including GST. A null amount
 * is this payment itself, worked out from the booking; any other line is
 * one the MC added (a travel fee, an extra hour) with an amount of its own.
 */
export interface LineItem {
  id: string;
  text: RichDoc;
  detail?: RichDoc | undefined;
  amount: number | null;
}

/** A working part's data: nothing, the document fills it. */
export type PartData = Record<string, never>;

/** A section kind production does not have. */
export type EngineKind = keyof EngineDataMap;

/** An engine section's data, tagged with its kind like production's `SectionData`. */
export type EngineData = { [K in EngineKind]: { kind: K } & { [P in K]: EngineDataMap[K] } }[EngineKind];

/** Every kind of section a document can hold. */
export type DocSectionKind = SectionKind | EngineKind;

/** One section of a document. */
export interface DocSection extends Omit<Section, 'kind' | 'data'> {
  kind: DocSectionKind;
  data?: SectionData | EngineData | undefined;
  /**
   * Part of every document of its type (a contract's signatures, an
   * email's footer): it can be moved and restyled, never deleted or
   * duplicated.
   */
  locked?: true | undefined;
}

/** A document: its sections, and the page theme frozen into it once sent. */
export interface DocLayout extends Omit<ProposalLayout, 'sections'> {
  sections: DocSection[];
}
