'use client';

import { X } from 'lucide-react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';

import { shortDate } from '../../payments/dates';
import { CONSENT_WORDS, LISTS, reachOf } from '../campaigns-data';

/**
 * A list opened from the Lists tab: an `md` dialog with the list's name
 * and rule, and Email this list as the one primary. Below, the facts
 * (people, how many can be emailed, the consent it rests on, when it was
 * last emailed), then a few of the people on it, anyone unsubscribed
 * shown quieter with the date, and how many more.
 *
 * @module app/design-system/v2/pages/dashboard/email/lists/list-dialog
 */

export interface ListDialogProps {
  /** The open list's id; closed while null. */
  id: string | null;
  /** Starts a campaign to the list, by its name. */
  onNewCampaign: (listName: string) => void;
  onClose: () => void;
}

/** The list dialog. See {@link ListDialogProps}. */
export function ListDialog({ id, onNewCampaign, onClose }: ListDialogProps) {
  const l = id ? LISTS.find((x) => x.id === id) : undefined;
  return (
    <Dialog open={l !== undefined} onClose={onClose} size="md" aria-labelledby="list-title">
      {l ? (
        <>
          <header className="flex flex-wrap items-start gap-x-6 gap-y-4 border-b border-zebra-950/5 px-5 pb-5 pt-6 md:px-8">
            <div className="min-w-0 flex-1 space-y-1">
              <h2 id="list-title" className="type-title text-zebra-950">
                {l.name}
              </h2>
              <p className="type-body text-zebra-500">{l.rule}</p>
            </div>
            <div className="flex items-center gap-2 max-sm:order-last max-sm:w-full">
              <Button onClick={() => onNewCampaign(l.name)}>Email this list</Button>
            </div>
            <div className="sm:border-l sm:border-zebra-950/5 sm:pl-4">
              <Button variant="ghost" square aria-label="Close" onClick={onClose}>
                <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
              </Button>
            </div>
          </header>
          <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-5 md:p-8">
            <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-2.5 type-body">
              <dt className="text-zebra-500">People</dt>
              <dd className="tabular-nums text-zebra-950">{l.people}</dd>
              <dt className="text-zebra-500">Can be emailed</dt>
              <dd className="tabular-nums text-zebra-950">
                {reachOf(l)}
                <span className="text-zebra-500"> · {l.unsubscribed} unsubscribed</span>
              </dd>
              <dt className="text-zebra-500">Consent</dt>
              <dd className="text-zebra-950">{CONSENT_WORDS[l.consent]}</dd>
              <dt className="text-zebra-500">Last emailed</dt>
              <dd className="text-zebra-950">{l.lastEmailedOn ? shortDate(l.lastEmailedOn) : 'Never'}</dd>
            </dl>
            <section aria-labelledby="list-people" className="space-y-3">
              <h3 id="list-people" className="type-subheading text-zebra-950">
                Who is on it
              </h3>
              <ul className="divide-y divide-zebra-950/5 type-body">
                {l.sample.map((m) => (
                  <li key={m.names} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className={`block truncate ${m.unsubscribedOn ? 'text-zebra-400' : 'text-zebra-950'}`}>{m.names}</span>
                      <span className="block truncate text-zebra-500">{m.detail}</span>
                    </span>
                    {m.unsubscribedOn ? <span className="shrink-0 text-zebra-400">Unsubscribed {shortDate(m.unsubscribedOn)}</span> : null}
                  </li>
                ))}
              </ul>
              {l.people > l.sample.length ? (
                <p className="type-body text-zebra-500">and {l.people - l.sample.length} more</p>
              ) : null}
            </section>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}
