'use client';

import { useId, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import {
  CalendarIcon,
  CallIcon,
  ClientsIcon,
  EmailIcon,
  GuestsIcon,
  JourneysIcon,
  MicIcon,
  NotesIcon,
  PackageIcon,
  PaymentsIcon,
  SourceIcon,
  UserIcon,
  UserPlusIcon,
  VenueIcon,
} from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';
import { PropertyChip } from '@/components/ui-v2/property-chip';

/**
 * "Hairline + icons" applied everywhere, so the user can judge it for
 * consistency (2026-10-15): New client and a client's Overview, both
 * with every field as a hairline box with its name above and its icon
 * inside. Mocks only: static data, no primitive changes.
 *
 * @module app/design-system/v2/light-box/client-mocks
 */

const BOX =
  'rounded-button border border-zebra-200 bg-white transition-[border-color,box-shadow] duration-150 hover:border-zebra-300 focus-within:border-zebra-400 focus-within:ring-[3px] focus-within:ring-zebra-950/5 motion-reduce:transition-none';

/** One hairline field: name above, icon inside the box. `rows` makes it multi-line. */
export function HairlineField({
  icon: Icon,
  label,
  value = '',
  type,
  rows,
}: {
  icon: ZebriIcon;
  label: string;
  value?: string;
  type?: string;
  rows?: number;
}) {
  const id = useId();
  const [v, setV] = useState(value);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block type-label text-zebra-700">
        {label}
      </label>
      {rows ? (
        <div className={`flex gap-2 px-3 py-2 ${BOX}`}>
          <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-zebra-400" />
          <textarea
            id={id}
            rows={rows}
            value={v}
            onChange={(e) => setV(e.target.value)}
            className="w-full min-w-0 resize-none bg-transparent type-body text-zebra-950 outline-none"
          />
        </div>
      ) : (
        <div className={`flex h-9 items-center gap-2 px-3 ${BOX}`}>
          <Icon aria-hidden="true" className="size-4 shrink-0 text-zebra-400" />
          <input
            id={id}
            type={type}
            value={v}
            onChange={(e) => setV(e.target.value)}
            className="h-full w-full min-w-0 bg-transparent type-body text-zebra-950 outline-none"
          />
        </div>
      )}
    </div>
  );
}

const noop = () => undefined;

/** New client, as a static dialog card. */
export function NewClientMock() {
  return (
    <div className="overflow-hidden rounded-panel bg-white shadow-btn-soft ring-1 ring-hairline">
      <DialogHeader id="mock-new-client" title="Priya & Dev" icon={ClientsIcon} closable={false} />
      <DialogBody className="flex flex-col gap-6 sm:pt-6">
        <div className="space-y-4">
          <HairlineField icon={UserIcon} label="Primary contact" value="Priya" />
          <HairlineField icon={UserPlusIcon} label="Secondary contact" value="Dev" />
          <div className="grid gap-4 sm:grid-cols-2">
            <HairlineField icon={EmailIcon} label="Email" type="email" />
            <HairlineField icon={CallIcon} label="Phone" type="tel" />
          </div>
        </div>
        {/* The detail chips stay as they are: optional extras, not fields to fill. */}
        <div className="-mx-2.5 flex flex-wrap gap-1">
          <PropertyChip
            icon={JourneysIcon}
            label="Journey"
            value="Wedding journey"
            open={false}
            onOpenChange={noop}
          >
            {null}
          </PropertyChip>
          <PropertyChip
            icon={CalendarIcon}
            label="Event date"
            value="Sat 10 Apr 2027 · in 177 days"
            open={false}
            onOpenChange={noop}
          >
            {null}
          </PropertyChip>
          <PropertyChip icon={VenueIcon} label="Venue" open={false} onOpenChange={noop}>
            {null}
          </PropertyChip>
          <PropertyChip icon={GuestsIcon} label="Guests" open={false} onOpenChange={noop}>
            {null}
          </PropertyChip>
          <PropertyChip icon={PackageIcon} label="Package" open={false} onOpenChange={noop}>
            {null}
          </PropertyChip>
          <PropertyChip icon={SourceIcon} label="Found you via" open={false} onOpenChange={noop}>
            {null}
          </PropertyChip>
        </div>
        <HairlineField icon={NotesIcon} label="Notes" rows={4} />
      </DialogBody>
      <DialogFooter>
        <Button>Add client</Button>
      </DialogFooter>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: ZebriIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="contents">
      <dt className="flex h-9 items-center gap-3 text-zebra-500">
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        {label}
      </dt>
      <dd className="flex min-h-9 min-w-0 items-center text-zebra-950">{children}</dd>
    </div>
  );
}

/** A client's Overview, either boxed like the form or kept as the property sheet. */
export function ClientOverviewMock({ boxed }: { boxed: boolean }) {
  return (
    <div className="space-y-5 rounded-panel bg-white p-6 shadow-btn-soft ring-1 ring-hairline">
      <h3 className="type-subheading text-zebra-950">Priya & Dev</h3>
      {boxed ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <HairlineField icon={CalendarIcon} label="Date" value="Sat 10 Apr 2027, 2:30pm" />
          <HairlineField icon={VenueIcon} label="Venue" value="Stones of the Yarra Valley" />
          <HairlineField icon={MicIcon} label="Rehearsal" value="Fri 9 Apr, 5pm" />
          <HairlineField icon={GuestsIcon} label="Guests" value="120 guests" />
          <HairlineField icon={PackageIcon} label="Package" value="Ceremony and reception" />
          <HairlineField icon={SourceIcon} label="Source" value="Instagram" />
          <div className="sm:col-span-2">
            <HairlineField
              icon={NotesIcon}
              label="Notes"
              rows={3}
              value="Dev's grandmother is flying in from Delhi. Say her name right: Kamala."
            />
          </div>
        </div>
      ) : (
        <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-1 type-body">
          <Row icon={JourneysIcon} label="Journey">
            Wedding · 5 of 7
          </Row>
          <Row icon={CalendarIcon} label="Date">
            Sat 10 Apr 2027, 2:30pm
          </Row>
          <Row icon={VenueIcon} label="Venue">
            Stones of the Yarra Valley
          </Row>
          <Row icon={MicIcon} label="Rehearsal">
            Fri 9 Apr, 5pm
          </Row>
          <Row icon={GuestsIcon} label="Guests">
            120 guests
          </Row>
          <Row icon={PackageIcon} label="Package">
            Ceremony and reception
          </Row>
          <Row icon={PaymentsIcon} label="Paid">
            $900 of $2,400
          </Row>
          <Row icon={SourceIcon} label="Source">
            Instagram
          </Row>
        </dl>
      )}
    </div>
  );
}
