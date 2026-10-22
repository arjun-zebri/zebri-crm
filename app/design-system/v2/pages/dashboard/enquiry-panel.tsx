'use client';

import { Avatar } from '@/components/ui-v2/avatar';
import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { ROW } from '@/components/ui-v2/control-styles';
import { SettingsIcon, SetupIcon } from '@/components/ui-v2/icons';

import { ENQUIRIES, type Enquiry } from './demo-activity';
import { availability, SOURCE_ICON, sourceLabel } from './enquiries/enquiries-data';
import { PanelFooter, PanelHeader, WhenDot } from './panel-parts';

/**
 * What the Enquiries button opens: every new enquiry with its date,
 * guest count, the start of their message and where it came from. A
 * row opens the enquiry modal. Only a clash earns an extra line (amber,
 * who has the date); a free date shows nothing, so the list stays
 * quiet. A replied enquiry says so where the unread dot was. The foot
 * leads to Settings, on its Enquiries tab, where sources are connected. Until one
 * source is set up there is nothing to list: a line saying where
 * enquiries come from, and the foot's button reads Set up instead. Read,
 * replied and archived state live with the caller, so the button's
 * count stays in step.
 *
 * @module app/design-system/v2/pages/dashboard/enquiry-panel
 */

export interface EnquiryPanelProps {
  /** What to list; the demo's when left out. */
  items?: readonly Enquiry[] | undefined;
  /** Ids still unread. */
  unread: ReadonlySet<string>;
  /** Ids already answered. */
  replied?: ReadonlySet<string> | undefined;
  /** Mark one enquiry read, or all of them with no id. */
  onRead: (id?: string) => void;
  /** Opens an enquiry in the modal. */
  onOpen?: ((id: string) => void) | undefined;
  /** Opens Settings on its Enquiries tab. */
  onSettings?: (() => void) | undefined;
  /** At least one source is connected; until then the panel asks the MC to set it up. */
  configured?: boolean | undefined;
}

/** The enquiries popover's content. See {@link EnquiryPanelProps}. */
export function EnquiryPanel({
  items = ENQUIRIES,
  unread,
  replied,
  onRead,
  onOpen,
  onSettings,
  configured = true,
}: EnquiryPanelProps) {
  return (
    <div>
      <section className="space-y-4 p-5 pb-3">
        <PanelHeader
          title="Enquiries"
          unread={unread.size}
          onReadAll={() => onRead()}
          empty={!configured || items.length === 0}
        />
        {!configured ? (
          // Left-aligned with a little room: centred with 24px around it was mostly white space.
          <p className="py-1 text-pretty type-body text-zebra-500">
            Connect your email or Instagram, and enquiries land here.
          </p>
        ) : items.length === 0 ? (
          <p className="py-1 text-pretty type-body text-zebra-500">No enquiries yet.</p>
        ) : null}
        {/* Only with rows: an empty list still took the section's gap. */}
        {items.length > 0 ? (
          <ul className="-mx-2">
            {items.map((e) => {
              const Icon = SOURCE_ICON[e.source];
              const date = availability(e);
              const answered = replied?.has(e.id) ?? false;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onRead(e.id);
                      onOpen?.(e.id);
                    }}
                    className={`flex w-full gap-3 rounded-button p-2 text-left ${ROW}`}
                  >
                    <Avatar name={e.client.replace(' & ', ' ')} tone="muted" />
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                      <span className="flex w-full items-baseline justify-between gap-3">
                        <span className="truncate type-label text-zebra-950">{e.client}</span>
                        {answered ? (
                          <span className="shrink-0 type-body text-zebra-400">Replied</span>
                        ) : (
                          <WhenDot ago={e.ago} unread={unread.has(e.id)} />
                        )}
                      </span>
                      <span className="type-body text-zebra-500">
                        {e.date} · {e.guests} guests
                      </span>
                      {date.free ? null : (
                        <span className="type-body text-warning-ink">
                          Booked that day · {date.with}
                        </span>
                      )}
                      <span className="w-full truncate type-body text-zebra-700">{e.message}</span>
                      <Badge>
                        <Icon aria-hidden="true" className="mr-1.5 size-3.5" />
                        {sourceLabel(e)}
                      </Badge>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
      <PanelFooter>
        {configured ? (
          <Button variant="secondary" className="w-full" onClick={onSettings} icon={<SettingsIcon aria-hidden="true" className="size-4" />}>
            Settings
          </Button>
        ) : (
          <Button className="w-full" onClick={onSettings} icon={<SetupIcon aria-hidden="true" className="size-4" />}>
            Set up
          </Button>
        )}
      </PanelFooter>
    </div>
  );
}
