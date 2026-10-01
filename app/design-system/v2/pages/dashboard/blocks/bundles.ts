import type { Role } from './catalog';

/**
 * The recommendation at the top of All: the few blocks most MCs,
 * celebrants or DJs start with, so a new account can set itself up in
 * one click instead of reading the whole catalogue. One per role.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/bundles
 */

/** A recommended set of blocks. `ids` are catalogue ids, none of them `soon`. */
export interface Bundle {
  pitch: string;
  ids: string[];
}

export const BUNDLES: Record<Role, Bundle> = {
  MC: {
    pitch: 'Timings, suppliers and every answer from the couple in one place, ready when you pick up the mic.',
    ids: ['timeline', 'suppliers', 'questionnaires'],
  },
  Celebrant: {
    pitch: 'Scripts in any language, signed paperwork and the couple’s story, without the chasing.',
    ids: ['scripts', 'contracts', 'questionnaires'],
  },
  DJ: {
    pitch: 'Enquiries in, calls booked and proposals out, all from your website.',
    ids: ['lead-capture', 'scheduler', 'proposals'],
  },
};
