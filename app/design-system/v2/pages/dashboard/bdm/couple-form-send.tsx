'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Checkbox } from '@/components/ui-v2/checkbox';
import { CircleCheckIcon } from '@/components/ui-v2/icons';

import { PHONE_BAR } from '../questionnaires/client-view/paged-style';

/**
 * The foot of the couple's Check your answers: each of them confirms
 * their answers are true and match their ID, then Send (user,
 * 2026-10-15: "we cannot get this wrong", so both sign it off, in place
 * of asking at the start who was filling it in). Once sent, the foot
 * says so where Send was, not on a page of its own that hid their
 * answers. They can still change an answer: the foot then asks them to
 * confirm and send the changes. Once the celebrant has checked the
 * notice it is locked, and says to email them instead.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/couple-form-send
 */

export interface CoupleFormSendProps {
  /** Their first names, for the two confirmations; one when only one is known. */
  names: string[];
  /** Who it goes to: "Sophie", or "your celebrant". */
  to: string;
  /** Nothing is missing or refused. */
  ready: boolean;
  /** Not sent yet, sent as it stands, or changed since it was sent. */
  status: 'new' | 'sent' | 'changed';
  /** The day it was last sent: "15 Oct". */
  sentOn?: string | undefined;
  /** The celebrant has checked it: no more changes from here. */
  locked: boolean;
  onSend: () => void;
  onBack: () => void;
}

/** The foot. See {@link CoupleFormSendProps}. */
export function CoupleFormSend({ names, to, ready, status, sentOn, locked, onSend, onBack }: CoupleFormSendProps) {
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const all = names.every((n) => confirmed.includes(n));
  const back = (
    <Button variant="secondary" onClick={onBack}>
      Back
    </Button>
  );
  if (locked || status === 'sent')
    return (
      <div className="space-y-4">
        <div role="status" className="flex gap-3 rounded-panel bg-grass-50 p-4">
          <CircleCheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-grass-700" />
          <div className="space-y-1 type-body">
            <p className="type-label text-zebra-950">Sent to {to}{sentOn ? ` on ${sentOn}` : ''}</p>
            <p className="text-zebra-700">
              {locked
                ? `${to[0]?.toUpperCase()}${to.slice(1)} has checked your notice. To change anything now, email them.`
                : 'They have your details. If something changes, edit the answer above and send it again.'}
            </p>
          </div>
        </div>
        <div className="flex justify-end">{back}</div>
      </div>
    );
  return (
    <div className="space-y-5">
      {status === 'changed' ? <p className="type-body text-warning-ink">You have changed answers since you sent them. Confirm and send the changes to {to}.</p> : null}
      <fieldset className="space-y-3">
        <legend className="mb-2 type-label text-zebra-900">Both of you confirm</legend>
        {names.map((n) => (
          <Checkbox
            key={n}
            label={`${n} confirms these details are true and match their ID`}
            checked={confirmed.includes(n)}
            onChange={(e) => setConfirmed((c) => (e.target.checked ? [...c, n] : c.filter((x) => x !== n)))}
          />
        ))}
      </fieldset>
      <div className={`flex justify-end gap-3 ${PHONE_BAR}`}>
        {back}
        <Button disabled={!ready || !all} onClick={onSend}>
          {status === 'changed' ? `Send changes to ${to}` : `Send to ${to}`}
        </Button>
      </div>
    </div>
  );
}
