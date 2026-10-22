'use client';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { GroupLabel } from '@/components/ui-v2/group-label';
import { ClientsIcon } from '@/components/ui-v2/icons';

import { fullDate } from '../../payments/dates';
import { CONSENT_WORDS, LISTS, reachOf } from '../campaigns-data';
import { RecordLead } from '../record-lead';

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
          <DialogHeader
            id="list-kind"
            icon={ClientsIcon}
            title="List"
            actions={<Button onClick={() => onNewCampaign(l.name)}>Email this list</Button>}
          />
          <RecordLead id="list-title" name={l.name}>
            <p className="type-body text-zebra-500">{l.rule}</p>
          </RecordLead>
          <DialogBody className="space-y-8">
            <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-2.5 type-body">
              <dt className="text-zebra-500">People</dt>
              <dd className="type-numeric text-zebra-950">{l.people}</dd>
              <dt className="text-zebra-500">Can be emailed</dt>
              <dd className="type-numeric text-zebra-950">
                {reachOf(l)}
                <span className="text-zebra-500"> · {l.unsubscribed} unsubscribed</span>
              </dd>
              <dt className="text-zebra-500">Consent</dt>
              <dd className="text-zebra-950">{CONSENT_WORDS[l.consent]}</dd>
              <dt className="text-zebra-500">Last emailed</dt>
              <dd className="text-zebra-950">
                {l.lastEmailedOn ? fullDate(l.lastEmailedOn) : 'Never'}
              </dd>
            </dl>
            <section aria-labelledby="list-people" className="space-y-3">
              <GroupLabel as="h4" id="list-people">
                Who is on it
              </GroupLabel>
              <ul className="space-y-1 type-body">
                {l.sample.map((m) => (
                  <li key={m.names} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="min-w-0">
                      <span
                        className={`block truncate ${m.unsubscribedOn ? 'text-zebra-400' : 'text-zebra-950'}`}
                      >
                        {m.names}
                      </span>
                      <span className="block truncate text-zebra-500">{m.detail}</span>
                    </span>
                    {m.unsubscribedOn ? (
                      <span className="shrink-0 text-zebra-400">
                        Unsubscribed {fullDate(m.unsubscribedOn)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              {l.people > l.sample.length ? (
                <p className="type-body text-zebra-500">and {l.people - l.sample.length} more</p>
              ) : null}
            </section>
          </DialogBody>
        </>
      ) : null}
    </Dialog>
  );
}
