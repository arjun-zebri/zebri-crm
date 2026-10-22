'use client';

import { createContext, use, type CSSProperties, type ReactNode } from 'react';

import { newSectionId, themeRoleCss } from '@/features/proposals';
import type { ProposalTheme, SectionStyle, ThemeTextRole } from '@/features/proposals';
import type { DocumentVariable } from '@/lib/branding/document-variables';

import type { DocSection, EngineKind } from '../../model/types';
import type { SectionBodyProps } from '../../registry/spec';

/**
 * A document's working parts: the questionnaire's questions, a contract's
 * signatures, an invoice's details, lines and how to pay. Each is a
 * locked section Zebri fills in (moved and restyled, never deleted or
 * typed into) whose body comes from the document it is drawn for, handed
 * down by `DocPartsProvider`, so one design serves every questionnaire,
 * contract or invoice the MC sends. They draw in the page's own type
 * (`themeRoleCss`) and the section's text colour, as production's
 * sections do, so a background or a font change in the brand kit reaches
 * them like any other section.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/sections/parts/parts
 */

/** The kinds of section that are a document's working parts. */
export type PartKind = Extract<EngineKind, 'questions' | 'agreement' | 'clauses' | 'signatures' | 'invoiceHead' | 'lineItems' | 'payment'>;

/** Draws one part for the section it sits in. */
export type PartRender = (props: SectionBodyProps) => ReactNode;

/** Each part a document has, drawn from its data. */
export type DocParts = Partial<Record<PartKind, PartRender>>;

const PART_KINDS: ReadonlySet<string> = new Set<PartKind>(['questions', 'agreement', 'clauses', 'signatures', 'invoiceHead', 'lineItems', 'payment']);

/** Whether `kind` is a document's working part. */
export const isPartKind = (kind: string): kind is PartKind => PART_KINDS.has(kind);

/** A document's own fields, beyond a proposal's: what `@` offers in it, and their values for the document in hand. */
export interface DocFields {
  list: readonly DocumentVariable[];
  values: Record<string, string>;
}

const PartsContext = createContext<{ parts: DocParts; fields: DocFields | null }>({ parts: {}, fields: null });

/**
 * Hands a document's parts, and its own fields when it has some (a
 * contract's package and fee), to everything under it: the editor,
 * Preview and the sent copy.
 */
export function DocPartsProvider({ parts, fields = null, children }: { parts: DocParts; fields?: DocFields | null | undefined; children: ReactNode }) {
  return <PartsContext value={{ parts, fields }}>{children}</PartsContext>;
}

/** The document's own fields, or null for one with only a proposal's. */
export const useDocFields = (): DocFields | null => use(PartsContext).fields;

/** A part section's body: the document's own drawing of it, or nothing when no document is in hand. */
export function PartView(props: SectionBodyProps) {
  const { parts } = use(PartsContext);
  const render = parts[props.section.kind as PartKind];
  return render ? render(props) : null;
}

/** A locked part section of `kind`, in the shared text column. */
export function partSection(kind: PartKind, name: string, style: Partial<SectionStyle> = {}): DocSection {
  return { id: newSectionId(), kind, name, locked: true, style: { height: 'fit', contentWidth: 'medium', ...style }, data: { kind, [kind]: {} } as DocSection['data'] };
}

/** The theme's type for `role`, less its alignment: a part lays its own words out (a total sits right). */
function typeOf(theme: ProposalTheme, role: ThemeTextRole, inheritColor: boolean): CSSProperties {
  return { ...themeRoleCss(theme, role, { inheritColor }), textAlign: undefined };
}

/** The page's type for `role`, in the section's text colour. */
export const roleCss = (theme: ProposalTheme, role: ThemeTextRole): CSSProperties => typeOf(theme, role, true);

/** A heading in the page's type: the theme's heading colour, unless the section sets its own text colour (a dark band). */
export const headingCss = (theme: ProposalTheme, role: ThemeTextRole, section: DocSection): CSSProperties => typeOf(theme, role, Boolean(section.style.textColor));

/** Words in the page's paragraph type; `muted` reads quieter, `strong` bolder. */
export function PartText({ theme, muted = false, strong = false, className = '', children }: { theme: ProposalTheme; muted?: boolean; strong?: boolean; className?: string; children: ReactNode }) {
  return (
    // The page's own type: runtime values from its theme.
    <p style={{ ...roleCss(theme, 'paragraph'), ...(strong ? { fontWeight: 600 } : {}) }} className={`${muted ? 'opacity-70' : ''} ${className}`}>
      {children}
    </p>
  );
}

/** A small label's type: the page's paragraph face, small, spaced and in capitals. */
export const eyebrowCss = (theme: ProposalTheme): CSSProperties => ({ ...roleCss(theme, 'paragraph'), fontSize: '12px', letterSpacing: '0.12em', fontWeight: 600, textTransform: 'uppercase' });

/** A small label over a heading or a value ("Contract", "Billed to"), in the brand colour when `brand` is given. */
export function Eyebrow({ theme, brand, children }: { theme: ProposalTheme; brand?: string | undefined; children: ReactNode }) {
  return (
    // The page's type at a label's size, and the MC's brand colour: runtime values.
    <p style={{ ...eyebrowCss(theme), ...(brand ? { color: brand } : {}) }} className={brand ? '' : 'opacity-70'}>
      {children}
    </p>
  );
}

/** A hairline in the section's text colour, faint enough to sit on any background. */
export const RULE = 'border-current/15';
