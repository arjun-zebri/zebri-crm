'use client';

import { Button } from '@/components/ui-v2/button';

import type { Paperwork } from '../../bdm/bdm-data';
import { CheckGroups } from '../../bdm/check-groups';
import { afterGroups, type CheckGroup } from '../../bdm/checks';
import { formTemplate } from '../../bdm/noim-questions';
import { ClientView } from '../../questionnaires/client-view/client-view';
import { TYPE_META } from '../../questionnaires/questionnaire-data';

import { BlockImageFrame, SCENE_CARD, SCENE_WIDE } from './block-image-frame';

/**
 * Lodge with BDM product image: the couple's "Your marriage details" form
 * at one of Grace's questions, and in front, the Lodge step with everyone
 * who signs the certificate of marriage ticked off. Both are built from the
 * product's own form and checks, so the image asks exactly what BDM's
 * lodgement asks. Laid out on a 640 by 360 scene at 75%, as the Calendar
 * image is.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/images/bdm
 */

const none = () => undefined;

// Grace and Ollie, as the product holds them, so the form and the checks are BDM's own.
const GRACE: Paperwork = {
  client: 'Grace & Ollie',
  names: ['Grace', 'Ollie'],
  date: 'Sat 3 Oct 2026',
  venue: 'Gunners Barracks',
  stage: 'sent',
  answers: { 'p1.givenName': 'Grace', 'p1.familyName': 'Whitfield', 'p1.birthCountry': 'New Zealand' },
  checks: {},
  certificate: 'none',
};

// Who signs the certificate of marriage: the first of the Lodge step's groups, all ticked.
const SIGNED: CheckGroup[] = afterGroups(GRACE).slice(0, 1);
const ALL_SIGNED = Object.fromEntries(SIGNED[0]?.checks.map((c) => [c.id, 'Yes']) ?? []);

// Grace's step on her country of birth, counted among every question the couple are asked.
const FORM = formTemplate(GRACE);
const AT = FORM.questions.filter((q) => TYPE_META[q.type].isInput).findIndex((q) => q.id === 'p1.birthCountry');

/** The couple fill in their details once; after the wedding the celebrant ticks the signatures and lodges. */
export function BdmImage() {
  return (
    <BlockImageFrame alt="Grace's marriage details form, one question at a time, with her and Ollie's signed certificate ticked off and ready to lodge with BDM in front.">
      <div className={SCENE_WIDE}>
        <div className={`${SCENE_CARD} -bottom-6 left-8 top-5 w-[21rem] px-7 py-6`}>
          <ClientView template={FORM} answers={GRACE.answers} onAnswer={none} startAt={AT} />
        </div>
        <div className={`${SCENE_CARD} right-5 top-12 w-64 space-y-4 p-5 shadow-md`}>
          <p className="type-label text-zebra-500">Grace & Ollie · Lodge by Sat 17 Oct</p>
          <CheckGroups groups={SIGNED} values={ALL_SIGNED} onChange={none} />
          <div className="flex justify-end">
            <Button>Lodge with BDM</Button>
          </div>
        </div>
      </div>
    </BlockImageFrame>
  );
}
