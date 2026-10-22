'use client';

import type { DemoPackage } from '../../../onboarding/packages';
import { clientName } from '../../clients/clients-data';
import { PACKAGES } from '../../proposals/templates-data';

import { block, field, logo, M, page, part, picture, text, W } from './build';
import { businessFields, type DesignSpec } from './spec';
import { CtaButton, Packages } from './widgets/client-parts';

/**
 * The proposal as a design: a cover (logo, a picture, the couple, a
 * heading and a welcome) and a page of packages with Accept and pay. The
 * packages and the button are locked: they are how the couple says yes
 * and pays, and their prices are the MC's packages, never typed here.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/docs/proposal
 */

/** What a proposal is filled from. */
export interface ProposalData {
  /** "Sarah & Tom". */
  couple: string;
  /** Their date and venue. */
  when?: string | undefined;
  packages: DemoPackage[];
  chosen?: string | undefined;
}

export const PROPOSAL: DesignSpec<ProposalData> = {
  kind: 'proposal',
  label: 'Proposal',
  layout: () => ({
    id: 'proposal',
    kind: 'proposal',
    title: 'Proposal',
    pages: [
      page('proposal-1', [
        logo('logo', { x: M, y: 56, w: 260, h: 44 }),
        picture('hero', { x: M, y: 140, w: W, h: 420 }, 6),
        field('eyebrow', 'Couple and date', 'event.line', 'caption', { x: M, y: 608, w: W }, { color: 'kit:primary' }),
        field('couple', 'Couple', 'couple', 'heading', { x: M, y: 640, w: W }),
        text('intro', 'Welcome', 'Thank you for thinking of me for your day. Here is how I would run it, from the first welcome to the last dance, and what it costs.', 'body', { x: M, y: 716, w: 520 }, { color: 'kit:muted' }),
        block('band', { x: 0, y: 1043, w: 794, h: 80 }),
      ]),
      page('proposal-2', [
        text('pk-title', 'Heading', 'Choose your package', 'subheading', { x: M, y: M, w: W }),
        text('pk-intro', 'Text', 'Every package includes a planning call, your run sheet and me on the mic all night.', 'body', { x: M, y: 112, w: 520 }, { color: 'kit:muted' }),
        part('packages', 'Packages', 'packages', { x: M, y: 190, w: W, h: 300 }),
        part('accept', 'Accept and pay', 'accept', { x: M, y: 540, w: 300, h: 52 }),
        field('sign-off', 'Your name', 'mc', 'subheading', { x: M, y: 660, w: W }),
      ]),
    ],
  }),
  sample: (account) => {
    const c = account.clients[0];
    return {
      couple: c ? clientName(c) : 'Sarah & Tom',
      when: c ? `${c.date} · ${c.venue}` : 'Saturday 12 March 2027 · Stones of the Yarra Valley',
      packages: account.packages?.length ? account.packages : Object.values(PACKAGES),
      chosen: undefined,
    };
  },
  fill: ({ couple, when, packages, chosen }, account) => {
    const b = businessFields(account);
    return {
      fields: { ...b.fields, couple, 'event.line': when ?? '' },
      fieldNames: { ...b.fieldNames, couple: 'Couple', 'event.line': 'Date and venue' },
      widgets: {
        packages: () => <Packages packages={packages} chosen={chosen} />,
        accept: (size) => <CtaButton label="Accept and pay deposit" size={size} />,
      },
    };
  },
};
