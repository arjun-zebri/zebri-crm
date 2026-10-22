'use client';

import { useState } from 'react';



import type { Wedding } from '../../../onboarding/brand-doc-parts';
import { useAccount } from '../../account';
import type { ComposedPage } from '../../doc-builder/doc-types/proposal/composed';
import { draftKey, readDraft } from '../../doc-builder/doc-types/proposal/drafts';
import { filledSection, starterLayout } from '../../doc-builder/doc-types/proposal/starter';
import { choiceOf, readTemplate } from '../../doc-builder/doc-types/proposal/template-store';
import { useStarterFrom } from '../../doc-builder/doc-types/proposal/use-starter-from';
import type { DocLayout } from '../../doc-builder/model/types';
import type { BookingTerms, DocFor, FillSection } from '../../doc-builder/state/use-doc-editor';
import { packagesOf } from '../templates-data';

/**
 * Where a couple's proposal opens from, shared by the Ready to send
 * screen and the full editor so both open the same page: the draft kept
 * for this couple and template if there is one, else the sent page
 * being changed, else the template written for this couple. Both keep
 * their work to the same draft (`key`), so moving between them never
 * loses a change.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/editor/use-proposal-start
 */

/** A sent proposal being changed: which one, and the page it went out as. */
export interface EditingSent {
  id: string;
  page: ComposedPage;
}

/** Who a proposal is for, and the template key it starts from. */
export interface ProposalTarget {
  couple: string;
  wedding: Wedding;
  template: string;
  editing?: EditingSent | undefined;
}

/**
 * A sent page made editable again: its frozen look is dropped, so the
 * draft wears the brand kit as it is now, and is frozen afresh on send.
 */
const unfrozen = (layout: DocLayout): DocLayout => {
  const rest = { ...layout };
  delete rest.theme;
  return rest;
};

/** The page a proposal opens on, read once per opening. See the module comment. */
export function useProposalStart(target: ProposalTarget) {
  const account = useAccount();
  const { from, values } = useStarterFrom();
  const { template } = choiceOf(target.template);
  const { couple, wedding, editing } = target;
  const key = editing ? `sent|${editing.id}` : draftKey(couple, target.template);
  // The MC's own packages when they have priced some; the template's otherwise.
  const packages = account.packages?.length ? account.packages : packagesOf(template);
  const who: DocFor = { couple, date: wedding.date, venue: wedding.venue };
  const fresh = () => (editing ? unfrozen(editing.page.layout) : starterLayout(template, { ...from, ...who }, packages, values, target.template));
  // Read once per opening: the caller keys this per couple and template.
  const [draft] = useState(() => readDraft(key));
  const [initial] = useState(() => draft?.layout ?? fresh());
  const initialTerms: BookingTerms | undefined = draft?.terms ?? editing?.page.terms ?? readTemplate(target.template)?.terms;
  const fill: FillSection = (kind) => filledSection(kind, template, packages);
  return { key, template, who, initial, initialTerms, restored: draft !== null, fresh, fill };
}
