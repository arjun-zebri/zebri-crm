'use client';

import { useId, type ReactNode } from 'react';

import type { Mark } from '@/app/design-system/v2/pages/onboarding/connections';
import { Button } from '@/components/ui-v2/button';
import { Collapse } from '@/components/ui-v2/collapse';
import { ConnectIcon } from '@/components/ui-v2/icons';
import { Swap } from '@/components/ui-v2/swap';

import type { Account } from './settings-data';
import type { EnquirySettings } from './use-enquiry-settings';

/**
 * The pieces the Settings tabs are made of: a titled section,
 * and the one row shape every source shares.
 * Plain rows on the dialog's white, spaced apart: no rules, no boxes,
 * no tiles behind the marks (v2 rulings).
 *
 * @module app/design-system/v2/pages/dashboard/enquiries/settings/pane-parts
 */

/** A section: a heading and one plain line on what it does, then its rows. */
export function SettingsSection({ title, why, children }: { title: string; why: string; children?: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="space-y-0.5">
        {/* An h3 under the dialog's h2 (its header); label size, as Blocks' groups. */}
        <h3 id={id} className="type-label text-zebra-950">
          {title}
        </h3>
        {/* Kept short of the dialog's Close, which sits over the content's top right corner. */}
        <p className="max-w-xl type-body text-zebra-500">{why}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * One source as a row, the shape every source in the tab shares: its
 * mark, its name, a status line that eases in under the name only once
 * there is something to say (so a page of untouched sources is not a
 * column of "Not connected"), and its action on the right.
 */
export function SourceRow({ icon: Icon, color, name, status, on, action }: { icon: Mark; color?: string | undefined; name: string; status: string; on: boolean; action: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Icon aria-hidden className={`size-4 shrink-0 ${color ? '' : 'text-zebra-500'}`} {...(color ? { color } : {})} />
      <span className="min-w-0 flex-1">
        <span className="block type-label text-zebra-950">{name}</span>
        {/* The text stays while it folds shut, so the line never empties mid-fold. */}
        <Collapse open={on}>
          <span className="block truncate type-body text-zebra-500">{status}</span>
        </Collapse>
      </span>
      {action}
    </div>
  );
}

/**
 * A source to connect (an inbox, Instagram, a calendar): a
 * {@link SourceRow} that says who it is connected as, with Connect or
 * Disconnect. The button hands over in place through `Swap`, so the row
 * never shifts; Connect shows its busy state while the pretend sign-in
 * runs. The one connect pattern: Settings' Enquiries and Calendar tabs
 * and Booking links' first use all use it.
 */
export function ConnectSourceRow({
  icon,
  color,
  name,
  as,
  on,
  busy,
  locked,
  onConnect,
  onDisconnect,
}: {
  icon: Mark;
  color?: string | undefined;
  name: string;
  /** The account it is connected as. */
  as: string;
  on: boolean;
  /** This one's sign-in is running. */
  busy: boolean;
  /** Another source's sign-in is running. */
  locked: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <SourceRow
      icon={icon}
      color={color}
      name={name}
      status={`Connected as ${as}`}
      on={on}
      action={
        <Swap
          active={on ? 'on' : 'off'}
          className="justify-items-end"
          states={{
            off: (
              <Button variant="secondary" loading={busy} icon={<ConnectIcon aria-hidden="true" className="size-4" />} disabled={locked && !busy} onClick={onConnect}>
                Connect
              </Button>
            ),
            on: (
              <Button variant="ghost" onClick={onDisconnect}>
                Disconnect
              </Button>
            ),
          }}
        />
      }
    />
  );
}

/** An inbox or Instagram: a {@link ConnectSourceRow} on the enquiry settings. */
export function ConnectRow({ account: a, settings: s }: { account: Account; settings: EnquirySettings }) {
  return (
    <ConnectSourceRow
      icon={a.icon}
      color={a.color}
      name={a.name}
      as={a.as}
      on={s.connected.has(a.id)}
      busy={s.connecting === a.id}
      locked={s.connecting !== null}
      onConnect={() => s.connect(a.id)}
      onDisconnect={() => s.disconnect(a.id)}
    />
  );
}
