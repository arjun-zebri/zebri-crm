'use client';

import { Button } from '@/components/ui-v2/button';
import { CircleCheckIcon, ClockIcon, FamilyTreeIcon, IdCardIcon, RingsIcon, type ZebriIcon } from '@/components/ui-v2/icons';

import { PHONE_BAR } from '../questionnaires/client-view/paged-style';

/**
 * The couple's form opens on a page of its own, before any question
 * (user, 2026-10-15): who it is for, what it is for, what to have to
 * hand, so nobody stalls halfway looking for a parent's birth country,
 * and that both of them confirm it at the end before it goes, since a
 * mistake here is a mistake on the marriage certificate. Then Start.
 * Asking who was filling it in was dropped the same day: it only
 * complicated a form both of them sign off.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/couple-form-welcome
 */

export interface CoupleFormWelcomeProps {
  /** Their names as the booking has them; either may be empty. */
  names: [string, string];
  /** The celebrant's name; empty for "your celebrant". */
  from: string;
  onStart: () => void;
}

/** What to have to hand, each with its glyph. */
const NEED: [ZebriIcon, string][] = [
  [IdCardIcon, 'The ID each of you will show: a birth certificate or passport. You can take a photo of it.'],
  [FamilyTreeIcon, "Your parents' names at birth and the countries they were born in"],
  [RingsIcon, 'If either of you has been married before: when and how it ended'],
  [ClockIcon, 'About 10 minutes. Your answers are kept as you go, so you can stop and come back.'],
];

/** The welcome page. See {@link CoupleFormWelcomeProps}. */
export function CoupleFormWelcome({ names, from, onStart }: CoupleFormWelcomeProps) {
  const known = names.map((n) => n.trim().split(/\s+/)[0] ?? '').filter(Boolean);
  return (
    <div className="space-y-8 motion-safe:animate-fade-in">
      <div className="space-y-3">
        <h2 className="type-title text-zebra-950">{known.length ? `Hi ${known.join(' and ')}` : 'Hello'}</h2>
        <p className="type-body text-zebra-700">
          {from || 'Your celebrant'} needs a few details to register your marriage with NSW Births, Deaths and Marriages. They are the
          questions on the Notice of Intended Marriage.
        </p>
      </div>
      <div className="space-y-3 rounded-panel bg-zebra-50 p-5">
        <h3 className="type-label text-zebra-950">What you will need</h3>
        <ul className="space-y-2.5">
          {NEED.map(([Icon, text]) => (
            <li key={text} className="flex gap-3 type-body text-zebra-700">
              <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-zebra-500" />
              {text}
            </li>
          ))}
        </ul>
      </div>
      <p className="flex gap-3 type-body text-zebra-700">
        <CircleCheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-grass-600" />
        <span>
          Either of you can fill it in. Before it is sent, you will both confirm every answer is right: these details go on your marriage
          certificate, so they have to match your ID exactly.
        </span>
      </p>
      <div className={`flex justify-end ${PHONE_BAR}`}>
        <Button onClick={onStart}>Start</Button>
      </div>
    </div>
  );
}
