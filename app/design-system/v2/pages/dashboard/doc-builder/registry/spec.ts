import type { ComponentType } from 'react';

import type { ZebriIcon } from '@/components/ui-v2/icons';
import type { ProposalTheme, RenderMode } from '@/features/proposals';
import type { PublicBranding } from '@/lib/branding/public-branding';

import type { DocSection, DocSectionKind, DocType } from '../model/types';

/**
 * What the engine knows about each kind of section: its name in plain
 * words, how it is edited, what it renders, and where it may go. One
 * entry per kind (`./kinds.ts`); the add list, the side panel, the page
 * and every preview read it, so a new kind is one entry plus its folder
 * under `sections/`.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/registry/spec
 */

/** What an engine section's body is drawn with. */
export interface SectionBodyProps {
  section: DocSection;
  theme: ProposalTheme;
  branding: PublicBranding;
  mode: RenderMode;
  /** The client's details that fill `@` fields in the section's words. */
  values?: Record<string, string> | undefined;
}

/**
 * How a kind is edited on the page:
 * - `text`: typed into in place (production's TipTap frame);
 * - `inline`: production's inline fields on the page (packages, accept);
 * - `panel`: shown as sent, a click opens its panel;
 * - `none`: nothing to edit (a new page marker).
 */
export type EditStyle = 'text' | 'inline' | 'panel' | 'none';

export interface SectionSpec {
  kind: DocSectionKind;
  /** "Reviews", "Common questions". */
  label: string;
  /** One line on what it is, for the add list. */
  help: string;
  /** A custom Zebri glyph (`components/ui-v2/icons`), drawn with the new-icon skill. */
  icon: ZebriIcon;
  edit: EditStyle;
  /** Offered under "Add to the page"; false for a kind kept only so old pages still open. */
  addable: boolean;
  /** Document types it may be added to; every type when absent. */
  allowedIn?: readonly DocType[] | undefined;
  /** An engine kind's body; production kinds draw through production's renderer. */
  Body?: ComponentType<SectionBodyProps> | undefined;
  /** A fresh section of this kind, filled; production kinds use the document's own `fill`. */
  create?: (() => DocSection) | undefined;
}
