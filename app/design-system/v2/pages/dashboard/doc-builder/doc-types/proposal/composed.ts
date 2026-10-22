import { plainText, resolvePackageOptions } from '@/features/proposals';
import type {PackageOption } from '@/features/proposals';
import type { PublicBranding } from '@/lib/branding/public-branding';

import type { DemoPackage } from '../../../../onboarding/packages';
import type { DocLayout } from '../../model/types';
import type { BookingTerms, DocEditor } from '../../state/use-doc-editor';

/**
 * A composed page as it was sent: the layout with its theme written in,
 * the branding it wore, and the booking terms. Frozen at send (spec §3:
 * sent documents never follow a later brand change), so the couple and
 * the MC both see exactly what went out.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/proposal/composed
 */
export interface ComposedPage {
  layout: DocLayout;
  branding: PublicBranding;
  terms: BookingTerms;
}

/** The page's packages, in order. */
export function packagesOn(layout: DocLayout): PackageOption[] {
  const pk = layout.sections.find((s) => s.data?.kind === 'packages')?.data;
  return pk?.kind === 'packages' ? resolvePackageOptions(pk.packages) : [];
}

/** A package option as the rest of the demo reads one: a name, a price, its lines. */
export const demoPackageOf = (o: PackageOption): DemoPackage => ({
  name: plainText(o.title).trim(),
  price: o.fixedPrice ?? 0,
  lines: o.items.filter((i) => !i.isAddon).map((i) => plainText(i.description)).filter(Boolean),
});

/** What stops a page going, and the section to fix it in (null when the fix is to add one). */
export interface Blocker {
  message: string;
  sectionId: string | null;
}

/** Why the page cannot go yet, with where to fix it, or null when it can: every package needs a name and a price. */
export function blockerOf(layout: DocLayout): Blocker | null {
  const section = layout.sections.find((s) => s.data?.kind === 'packages');
  const options = packagesOn(layout);
  if (!section || !options.length) return { message: 'Add a packages section so they have something to choose.', sectionId: null };
  const bad = options.find((o) => !plainText(o.title).trim() || !(o.fixedPrice ?? 0));
  return bad ? { message: 'Give every package a name and a price.', sectionId: section.id } : null;
}

/** The builder's page, frozen for sending, and the package the older demo views read. */
export function freeze(c: DocEditor): { composed: ComposedPage; offer: DemoPackage } {
  const options = packagesOn(c.state.layout);
  const lead = options.find((o) => o.isPopular) ?? options[0];
  return {
    composed: { layout: { ...c.state.layout, theme: c.theme, page: { ...c.state.layout.page, depositPercent: c.terms.deposit } }, branding: c.branding, terms: c.terms },
    offer: lead ? demoPackageOf(lead) : { name: '', price: 0, lines: [] },
  };
}
