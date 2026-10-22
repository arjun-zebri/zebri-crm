import {
  AcceptIcon,
  CommonQuestionsIcon,
  ContractIcon,
  FileEditIcon,
  HeaderSectionIcon,
  InvoiceIcon,
  ListOrderedIcon,
  NewPageIcon,
  PackageIcon,
  PaymentsIcon,
  PhotosIcon,
  QuestionnaireIcon,
  ReceiptIcon,
  ReviewsIcon,
  TextSectionIcon,
  VideoIcon,
} from '@/components/ui-v2/icons';

import type { DocSection, DocSectionKind, DocType } from '../model/types';
import { headerSection } from '../sections/header/data';
import { HeaderView } from '../sections/header/view';
import { PartView } from '../sections/parts/parts';
import { blankReview, reviewsSection } from '../sections/reviews/data';
import { ReviewsView } from '../sections/reviews/view';

import type { SectionSpec } from './spec';

/**
 * Every kind of section, in the order "Add to the page" lists them.
 * Reviews are production's testimonials, since the editor is production's
 * (2026-10-10); the engine's own starred Reviews kind stays only so pages
 * sent with it still show. FAQ reads as "Common questions" so it is never
 * mistaken for a questionnaire's questions. A document's working parts
 * (its questions, signatures, lines; `sections/parts/`) come with its
 * starter, locked, so Add never offers them (a contract's booking
 * details and clauses are words now; their parts stay so older pages
 * still open). Each part's
 * `help` says where its content comes from, on the section bar as well
 * as in Add. Packages belong to proposals.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/registry/kinds
 */

export const SPECS: readonly SectionSpec[] = [
  { kind: 'header', label: 'Header', help: 'Your logo across the top', icon: HeaderSectionIcon, edit: 'inline', addable: true, Body: HeaderView, create: headerSection },
  { kind: 'content', label: 'Text', help: 'Words, pictures, tables, buttons', icon: TextSectionIcon, edit: 'text', addable: true },
  { kind: 'packages', label: 'Packages', help: 'What you offer, with prices', icon: PackageIcon, edit: 'inline', addable: true, allowedIn: ['proposal', 'custom'] },
  { kind: 'gallery', label: 'Photos', help: 'A grid or a slideshow', icon: PhotosIcon, edit: 'panel', addable: true },
  { kind: 'video', label: 'Video', help: 'YouTube, Vimeo or Loom', icon: VideoIcon, edit: 'panel', addable: true },
  { kind: 'testimonials', label: 'Reviews', help: 'What past clients said', icon: ReviewsIcon, edit: 'inline', addable: true },
  {
    kind: 'reviews',
    label: 'Reviews',
    help: 'What past clients said, with stars',
    icon: ReviewsIcon,
    edit: 'panel',
    addable: false,
    Body: ReviewsView,
    create: () => reviewsSection([{ ...blankReview(), quote: 'You made the whole night feel effortless.', name: 'A past client' }]),
  },
  { kind: 'faq', label: 'Common questions', help: 'The ones every client asks', icon: CommonQuestionsIcon, edit: 'inline', addable: true },
  { kind: 'accept', label: 'Accept', help: 'Where they say yes', icon: AcceptIcon, edit: 'inline', addable: true, allowedIn: ['proposal', 'custom'] },
  { kind: 'pageBreak', label: 'New page', help: 'Starts a fresh page', icon: NewPageIcon, edit: 'none', addable: true },
  { kind: 'questions', label: 'Questions', help: 'Written in the questionnaire', icon: QuestionnaireIcon, edit: 'none', addable: false, Body: PartView },
  { kind: 'agreement', label: 'Booking details', help: 'Event, package and fee, filled in from each booking', icon: ContractIcon, edit: 'none', addable: false, Body: PartView },
  { kind: 'clauses', label: 'Clauses', help: 'The contract\u2019s wording', icon: ListOrderedIcon, edit: 'none', addable: false, Body: PartView },
  { kind: 'signatures', label: 'Signatures', help: 'Couples sign here online', icon: FileEditIcon, edit: 'none', addable: false, Body: PartView },
  { kind: 'invoiceHead', label: 'Invoice details', help: 'Number, dates and who it is for, filled in by Zebri', icon: InvoiceIcon, edit: 'none', addable: false, Body: PartView },
  { kind: 'lineItems', label: 'Line items', help: 'Filled in from each invoice, with GST', icon: ReceiptIcon, edit: 'none', addable: false, Body: PartView },
  { kind: 'payment', label: 'How to pay', help: 'Card online or bank transfer, set up by Zebri', icon: PaymentsIcon, edit: 'none', addable: false, Body: PartView },
];

const BY_KIND = new Map(SPECS.map((s) => [s.kind, s]));

/** The spec for `kind`. */
export const specFor = (kind: DocSectionKind): SectionSpec => BY_KIND.get(kind) ?? SPECS[0]!;

/** The kinds "Add to the page" offers in a `type` document. */
export const addableIn = (type: DocType) => SPECS.filter((s) => s.addable && (!s.allowedIn || s.allowedIn.includes(type)));

/**
 * What a section is called on the page: its kind ("Text", "Packages").
 * The starters name their sections ("Header", "Ready", "Footer") for the
 * code that tells them apart, but on the bar those read as kinds of
 * section that do not exist (founder, 2026-10-10: "wtf is a ready
 * section? ... it should just be a text section").
 */
export const sectionName = (section: DocSection) => specFor(section.kind).label;
