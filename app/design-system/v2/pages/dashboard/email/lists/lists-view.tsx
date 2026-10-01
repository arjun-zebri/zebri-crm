import { Panel } from '@/components/ui-v2/panel';
import { StretchedButton } from '@/components/ui-v2/stretched-button';

import { shortDate } from '../../payments/dates';
import { ROW } from '../../payments/invoice-row';
import { LISTS, type Consent } from '../campaigns-data';

/**
 * The Lists tab: one row per saved list, its name over the rule that
 * fills it, then how many people, how many unsubscribed, the consent it
 * rests on in two words, and when it was last emailed. A quiet line
 * above says lists keep themselves current, so the MC never imports or
 * tidies one. A row opens the list's dialog.
 *
 * @module app/design-system/v2/pages/dashboard/email/lists/lists-view
 */

/** The consent, short enough for a row. */
export const CONSENT_SHORT: Record<Consent, string> = { express: 'Opted in', inferred: 'Past or current client' };

/** The Lists tab. */
export function ListsView({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div className="space-y-3">
      <p className="type-body text-zebra-500">
        Lists keep themselves up to date from your clients. Everyone on them can unsubscribe in one click.
      </p>
      <Panel className="p-2">
        <ul>
          {LISTS.map((l) => (
            <li key={l.id}>
              <div className={`${ROW} grid-cols-[minmax(0,1fr)_auto] items-center lg:grid-cols-[minmax(0,1fr)_6rem_8rem_11rem_9rem]`}>
                <StretchedButton label={`Open list ${l.name}`} onClick={() => onOpen(l.id)}>
                  <span className="block truncate type-label text-zebra-950">{l.name}</span>
                  <span className="block truncate type-body text-zebra-500">{l.rule}</span>
                </StretchedButton>
                <span className="text-right type-label tabular-nums text-zebra-950">{l.people} people</span>
                <span className="hidden text-right type-body tabular-nums text-zebra-500 lg:block">{l.unsubscribed} unsubscribed</span>
                <span className="hidden truncate type-body text-zebra-700 lg:block">{CONSENT_SHORT[l.consent]}</span>
                <span className="col-span-2 truncate type-body text-zebra-500 lg:col-span-1 lg:text-right">
                  {l.lastEmailedOn ? `Emailed ${shortDate(l.lastEmailedOn)}` : 'Never'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
