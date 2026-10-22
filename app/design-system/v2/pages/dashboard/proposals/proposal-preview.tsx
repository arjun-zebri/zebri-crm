import { useMemo } from 'react';

import { brandVars, type Wedding } from '../../onboarding/brand-doc-parts';
import { BrandProposal } from '../../onboarding/brand-proposal';
import type { DemoPackage } from '../../onboarding/packages';
import type { Brand } from '../../onboarding/use-onboarding-state';
import { useAccount } from '../account';
import { SentPage } from '../doc-builder/doc-types/proposal/sent-page';
import { TemplatePage } from '../doc-builder/doc-types/proposal/template-page';
import { longDate } from '../payments/dates';

import type { ProposalSeed } from './proposals-data';
import { BRAND, DEPOSIT, MC, packagesOf, templateOf, type Template } from './templates-data';

/**
 * A proposal as the couple sees it: the onboarding's sample proposal
 * (`BrandProposal`) in the MC's brand, for one couple and template. The
 * proposal modal and the template preview show it full size; the
 * template cards show it shrunk (`TemplateThumb`). The brand arrives as
 * CSS custom properties on the wrapper, the one `style` here, as in the
 * onboarding's brand step.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/proposal-preview
 */

/** The wedding a proposal is for, as the page writes it. */
export const weddingOf = (p: ProposalSeed): Wedding => ({
  couple: p.names[1] ? `${p.names[0]} & ${p.names[1]}` : p.names[0],
  date: longDate(p.event),
  venue: p.venue,
  greet: p.names[1] ? `${p.names[0]} and ${p.names[1]}` : p.names[0],
});

/** A template's sample couple, on the onboarding demo's wedding date. */
export const sampleOf = (t: Template): Wedding => ({ ...t.sample, date: 'Saturday 12 March 2027' });

export interface ProposalPreviewProps {
  template: Template;
  wedding: Wedding;
  className?: string | undefined;
  /** The packages to offer, when not the template's (the MC's own). */
  packages?: DemoPackage[] | undefined;
  /** Whose proposal it is, when not the demo MC's. */
  business?: string | undefined;
  deposit?: number | undefined;
  /** The MC's brand, when not the demo's. */
  brand?: Brand | null | undefined;
  /** The MC's own name and what they are to the couple ("MC", "DJ"). */
  mc?: { name: string; role: string } | undefined;
  /** The welcome's heading and note, when not the template's. */
  headline?: string | undefined;
  welcome?: string | undefined;
}

/** The couple's page, with the brand set on it. See {@link ProposalPreviewProps}. */
export function ProposalPreview({ template, wedding, className = '', packages, business, deposit, brand, mc, headline, welcome }: ProposalPreviewProps) {
  const b = brand ?? BRAND;
  return (
    <div style={brandVars(b)} className={`overflow-hidden rounded-check shadow-lg ring-1 ring-hairline ${className}`}>
      <BrandProposal
        business={business ?? MC.business}
        name={mc?.name ?? business ?? MC.name}
        role={mc?.role}
        logoUrl={b.logoUrl}
        packages={packages ?? packagesOf(template)}
        deposit={deposit ?? DEPOSIT}
        wedding={wedding}
        headline={headline ?? template.headline}
        welcome={welcome}
        hints={false}
      />
    </div>
  );
}

/** The preview for a proposal. */
export function PreviewFor({ proposal, className }: { proposal: ProposalSeed; className?: string }) {
  const { offer } = proposal;
  // Memoised: a fresh array each render would rebuild the page (and its ids) every time.
  const packages = useMemo(() => (offer ? [offer] : undefined), [offer]);
  const account = useAccount();
  // One composed in the editor shows the page exactly as it went out.
  if (proposal.composed) return <SentPage page={proposal.composed} couple={weddingOf(proposal).couple} venue={proposal.venue} className={className} />;
  // One sent from the first proposal (the practice run) shows the original page it was sent as, in the account's name.
  if (proposal.welcome && proposal.offer)
    return (
      <ProposalPreview
        template={templateOf(proposal.template)}
        wedding={weddingOf(proposal)}
        className={className}
        headline={proposal.headline}
        welcome={proposal.welcome}
        packages={[proposal.offer]}
        business={account.business}
        deposit={account.deposit}
        brand={account.brand}
        mc={account.mc}
      />
    );
  // An older one shows its template's page for this couple, with its own package when it has one.
  return <TemplatePage template={proposal.template} wedding={weddingOf(proposal)} packages={packages} className={className} />;
}
