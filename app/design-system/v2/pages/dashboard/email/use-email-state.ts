'use client';

import { useMemo, useState } from 'react';

import { TODAY, addDays } from '../payments/dates';

import { CAMPAIGNS, MOMENTS, type Campaign } from './campaigns-data';
import { TEMPLATES, type EmailTemplate, type SignatureId } from './email-data';

/**
 * What the MC has done on the Email page this visit: templates archived
 * or restored, a template's signature switched, Zebri's suggested sends
 * scheduled, and warm readers followed up. Shared by every tab and
 * dialog, so a send scheduled from the Overview shows under Campaigns
 * at once. Demo only: nothing is saved, a reload starts over.
 *
 * @module app/design-system/v2/pages/dashboard/email/use-email-state
 */

/** Suggested sends go out the morning after they are scheduled. */
const SEND_AFTER_DAYS = 1;

/** What the views read and call. See {@link useEmailState}. */
export interface EmailState {
  /** Every template, with this visit's archiving and signature picks applied. */
  templates: EmailTemplate[];
  archive: (id: string) => void;
  restore: (id: string) => void;
  setSignature: (id: string, signature: SignatureId) => void;
  /** Every campaign, suggested sends the MC scheduled first. */
  campaigns: Campaign[];
  /** Moment ids scheduled this visit. */
  scheduled: ReadonlySet<string>;
  schedule: (momentId: string) => void;
  /** Names of warm readers followed up this visit. */
  followed: ReadonlySet<string>;
  followUp: (names: string) => void;
}

/** Email page state. See {@link EmailState}. */
export function useEmailState(): EmailState {
  const [archived, setArchived] = useState<ReadonlyMap<string, string | undefined>>(() => new Map());
  const [signatures, setSignatures] = useState<ReadonlyMap<string, SignatureId>>(() => new Map());
  const [scheduled, setScheduled] = useState<ReadonlySet<string>>(() => new Set());
  const [followed, setFollowed] = useState<ReadonlySet<string>>(() => new Set());

  const templates = useMemo(
    () =>
      TEMPLATES.map((t) => ({
        ...t,
        archivedOn: archived.has(t.id) ? archived.get(t.id) : t.archivedOn,
        signature: signatures.get(t.id) ?? t.signature,
      })),
    [archived, signatures],
  );
  const campaigns = useMemo(() => {
    const fromMoments: Campaign[] = MOMENTS.filter((m) => scheduled.has(m.id)).map((m) => ({
      id: `c-${m.id}`,
      name: m.title,
      template: m.template,
      list: m.list,
      group: 'scheduled',
      on: addDays(TODAY, SEND_AFTER_DAYS),
      recipients: m.people,
      delivered: 0, opened: 0, clicked: 0, replied: 0, unsubscribed: 0, booked: [], warm: [],
    }));
    return [...fromMoments, ...CAMPAIGNS];
  }, [scheduled]);

  return {
    templates,
    archive: (id) => setArchived((m) => new Map(m).set(id, TODAY)),
    restore: (id) => setArchived((m) => new Map(m).set(id, undefined)),
    setSignature: (id, s) => setSignatures((m) => new Map(m).set(id, s)),
    campaigns,
    scheduled,
    schedule: (id) => setScheduled((s) => new Set(s).add(id)),
    followed,
    followUp: (names) => setFollowed((s) => new Set(s).add(names)),
  };
}
