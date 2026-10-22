'use client';

import { useMemo } from 'react';

import type { Wedding } from '../../../../onboarding/brand-doc-parts';
import type { DemoPackage } from '../../../../onboarding/packages';
import { useAccount } from '../../../account';
import { packagesOf } from '../../../proposals/templates-data';
import { useKitLook } from '../../look/use-kit-look';
import { docFor } from '../../model/doc-data';
import { CouplePage } from '../../render/couple-page';

import { forCouple, templateLayout } from './starter';
import { choiceOf, useEditedTemplate } from './template-store';
import { useStarterFrom } from './use-starter-from';

/**
 * A template's page for one couple, as a proposal from it would open:
 * the MC's edit of the template (else Zebri's own), in the brand kit,
 * through the real renderer. The template cards, the template preview
 * and an older proposal with no composed page all show this, so every
 * picture of a proposal in the app is the page itself, never a drawing
 * of one (2026-10-05 review: the cards showed the retired green layout).
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/proposal/template-page
 */

export interface TemplatePageProps {
  /** The template key. */
  template: string;
  wedding: Wedding;
  /** The packages to offer, when not the account's or the template's. */
  packages?: DemoPackage[] | undefined;
  className?: string | undefined;
}

/** The page. See {@link TemplatePageProps}. */
export function TemplatePage({ template: key, wedding, packages, className = '' }: TemplatePageProps) {
  const account = useAccount();
  const { from, values } = useStarterFrom();
  const { branding, theme } = useKitLook();
  const edited = useEditedTemplate(key);
  // Memoised so the layout below is not rebuilt (with new ids) every render.
  const { template } = useMemo(() => choiceOf(key), [key]);
  const offer = useMemo(() => packages ?? (account.packages?.length ? account.packages : packagesOf(template)), [packages, account.packages, template]);
  const { couple, date, venue } = wedding;
  // Built once per input: a fresh build mints new section ids.
  const layout = useMemo(
    () => forCouple(edited?.layout ?? templateLayout(template, from, offer), { couple, date, venue }, values),
    [edited, template, from, offer, couple, date, venue, values],
  );
  const terms = edited?.terms ?? { contract: true, deposit: account.deposit, balanceDays: 30 };
  return (
    <div className={`overflow-hidden rounded-panel shadow-lg ring-1 ring-hairline ${className}`}>
      <CouplePage layout={{ ...layout, theme }} branding={branding} doc={docFor({ couple, date, venue }, terms.deposit)} terms={terms} mode="print" placeholders />
    </div>
  );
}
