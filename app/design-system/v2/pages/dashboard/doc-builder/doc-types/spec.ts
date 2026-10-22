import type { DocumentVariable } from '@/lib/branding/document-variables';

import type { MiniKind } from '../../brand/mini-docs';
import type { DocType } from '../model/types';

/**
 * What makes each kind of document itself on the one engine: its name,
 * how it is read (a web page, or an email at 600px), what Preview offers
 * and which stamp stands for it in the brand ripple. One entry per type
 * (`./index.ts`); the shell, the side panel and Preview read it.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/spec
 */

/** How a document is read. */
export interface DocOutput {
  /** The page's widest column, in px. */
  width: 960 | 600;
  /** Most columns a row can hold (an email client manages two). */
  maxColumns: 2 | 3;
  /** It can be printed or saved as a PDF too. */
  printable: boolean;
}

export interface DocTypeConfig {
  type: DocType;
  /** "Proposal", in the words the MC uses. */
  label: string;
  output: DocOutput;
  /** Its stamp in the brand ripple, when it has one. */
  ripple: MiniKind | null;
  /** What `@` offers in its words; the proposal's fields when absent. */
  fields?: readonly DocumentVariable[] | undefined;
}
