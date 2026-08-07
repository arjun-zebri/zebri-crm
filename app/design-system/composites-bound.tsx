'use client';

import { useState } from 'react';

import { ContractBuilderModal } from '@/components/builders/contract-builder-modal';
import { InvoiceBuilderModal } from '@/components/builders/invoice-builder-modal';
import { EventTasks } from '@/components/events/event-tasks';
import { EventTimeline } from '@/components/events/event-timeline';
import { EventVendors } from '@/components/events/event-vendors';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';

import { ClientOnly } from './client-only';
import { DEMO_COUPLE_ID, DEMO_EVENT_ID } from './fixtures';
import { MockProviders } from './mock-providers';
import { ReadOnlyPreview } from './read-only-preview';
import { Spec } from './showroom';

/**
 * Composites that read from Supabase, rendered against the seeded query
 * cache in {@link MockProviders}.
 *
 * Everything here is wrapped in {@link ReadOnlyPreview}: these carry live
 * mutations, and the dev server points at the remote database.
 *
 * @module app/design-system/composites-bound
 */

/** Composites still hard-bound to a live client, listed rather than rendered. */
const NOT_RENDERABLE = [
  {
    name: 'EventDayCalendar',
    file: 'components/events/event-day-calendar.tsx',
    lines: 851,
    why: 'Needs a dnd-kit context plus measured scroll containers. Renders blank at zero height outside a sized parent.',
  },
  {
    name: 'StopNoteDialog',
    file: 'components/time-tracking/stop-note-dialog.tsx',
    lines: 137,
    why: 'Driven entirely by a `pending` session object produced by TimerProvider when a timer stops.',
  },
  {
    name: 'TimerProvider / TimerPill',
    file: 'components/time-tracking/timer-provider.tsx',
    lines: 193,
    why: 'TimerPill returns null unless a timer is actually running, and useTimerSurface throws outside the provider.',
  },
  {
    name: 'EventProfile',
    file: 'components/events/event-profile.tsx',
    lines: 125,
    why: 'A shell around EventVendors, EventTasks and EventTimeline, all shown separately below.',
  },
];

/** The Supabase-bound composites, seeded and interaction-disabled. */
export function CompositesBound() {
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);

  return (
    <MockProviders>
      <Spec
        name="EventTimeline"
        file="components/events/event-timeline.tsx"
        importPath="@/components/events/event-timeline"
        description="Sortable run sheet with share controls. Seeded with five items."
      >
        <ReadOnlyPreview>
          {/* dnd-kit's id counter diverges between the server and client
              passes, so this one has to mount client-side. */}
          <ClientOnly fallback={<Loading label="Mounting timeline" />}>
            <EventTimeline eventId={DEMO_EVENT_ID} />
          </ClientOnly>
        </ReadOnlyPreview>
      </Spec>

      <Spec
        name="EventTasks"
        file="components/events/event-tasks.tsx"
        importPath="@/components/events/event-tasks"
        description="Per-event task list with inline create. Seeded with two tasks."
      >
        <ReadOnlyPreview>
          <EventTasks eventId={DEMO_EVENT_ID} />
        </ReadOnlyPreview>
      </Spec>

      <Spec
        name="EventVendors"
        file="components/events/event-vendors.tsx"
        importPath="@/components/events/event-vendors"
        description="Contacts assigned to an event. Seeded with two vendors."
      >
        <ReadOnlyPreview>
          <EventVendors eventId={DEMO_EVENT_ID} />
        </ReadOnlyPreview>
      </Spec>

      <Spec
        name="InvoiceBuilderModal"
        file="components/builders/invoice-builder-modal.tsx"
        importPath="@/components/builders/invoice-builder-modal"
        description="1,030 lines. Line items, payment stages, branding preview and send flow."
      >
        <Button variant="outline" onClick={() => setInvoiceOpen(true)}>
          Open invoice builder
        </Button>
        {invoiceOpen ? (
          <ReadOnlyPreview note="Opens as a live modal; close it with the button below.">
            <InvoiceBuilderModal
              invoiceId={null}
              initialCoupleId={DEMO_COUPLE_ID}
              isOpen
              onClose={() => setInvoiceOpen(false)}
            />
          </ReadOnlyPreview>
        ) : null}
        {invoiceOpen ? (
          <div className="mt-2">
            <Button variant="ghost" onClick={() => setInvoiceOpen(false)}>
              Close invoice builder
            </Button>
          </div>
        ) : null}
      </Spec>

      <Spec
        name="ContractBuilderModal"
        file="components/builders/contract-builder-modal.tsx"
        importPath="@/components/builders/contract-builder-modal"
        description="667 lines. Template picker, signature blocks and send flow."
      >
        <Button variant="outline" onClick={() => setContractOpen(true)}>
          Open contract builder
        </Button>
        {contractOpen ? (
          <ReadOnlyPreview note="Opens as a live modal; close it with the button below.">
            <ContractBuilderModal
              contractId={null}
              initialCoupleId={DEMO_COUPLE_ID}
              initialCoupleName="Alex and Sam"
              isOpen
              onClose={() => setContractOpen(false)}
            />
          </ReadOnlyPreview>
        ) : null}
        {contractOpen ? (
          <div className="mt-2">
            <Button variant="ghost" onClick={() => setContractOpen(false)}>
              Close contract builder
            </Button>
          </div>
        ) : null}
      </Spec>

      <Spec name="Not rendered here" description="Composites that need runtime state the showroom cannot fabricate.">
        <ul className="space-y-3">
          {NOT_RENDERABLE.map((c) => (
            <li key={c.name} className="space-y-0.5">
              <p className="text-body font-medium text-text">
                {c.name}{' '}
                <span className="font-normal text-text-subtle">({c.lines} lines)</span>
              </p>
              <code className="block text-body text-text-subtle">{c.file}</code>
              <p className="text-body text-text-muted">{c.why}</p>
            </li>
          ))}
        </ul>
      </Spec>
    </MockProviders>
  );
}
