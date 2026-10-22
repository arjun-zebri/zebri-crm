'use client';

import { Button } from '@/components/ui-v2/button';
import { StretchedButton } from '@/components/ui-v2/stretched-button';

import { CoupleAvatars, ROW } from '../payments/invoice-row';

import { progressOf, titleOf, type Sent } from './questionnaire-data';

/**
 * One sent questionnaire: the client and which questionnaire, how far
 * they are ("6 of 24 answered"), when it went, and Remind while it is
 * open (or when they were last reminded). Clicking the row opens their
 * copy. Laid out as a contract row, so Documents' kinds line up.
 *
 * @module app/design-system/v2/pages/dashboard/questionnaires/sent-row
 */

export interface SentRowProps {
  sent: Sent;
  onOpen: () => void;
  onRemind: () => void;
}

/** A sent questionnaire. See {@link SentRowProps}. */
export function SentRow({ sent: s, onOpen, onRemind }: SentRowProps) {
  const names = s.client.split(/\s*&\s*/);
  const done = s.status === 'completed';
  return (
    <li>
      <div className={`${ROW} grid-cols-[minmax(0,1fr)_auto] items-center lg:grid-cols-[minmax(0,1fr)_10rem_9.5rem]`}>
        <div className="flex min-w-0 items-center gap-3">
          <CoupleAvatars names={[names[0] ?? s.client, names[1] ?? '']} />
          <StretchedButton label={`Open ${titleOf(s.copy)}, ${s.client}`} onClick={onOpen}>
            <span className="block truncate type-label text-zebra-950">{s.client}</span>
            <span className="block truncate type-body text-zebra-500">{titleOf(s.copy)}</span>
          </StretchedButton>
        </div>
        <span className="type-body text-zebra-500 max-lg:hidden">{progressOf(s)}</span>
        <span className="relative justify-self-end">
          {done ? (
            <span className="type-body text-zebra-400">Sent {s.sentOn}</span>
          ) : s.remindedOn ? (
            <span className="type-body text-zebra-400">Reminded {s.remindedOn}</span>
          ) : (
            // Above the stretched button, so Remind is its own click.
            <Button variant="secondary" onClick={onRemind}>
              Remind
            </Button>
          )}
        </span>
        <span className="col-span-2 pl-[4.25rem] type-body text-zebra-500 lg:hidden">{progressOf(s)}</span>
      </div>
    </li>
  );
}
