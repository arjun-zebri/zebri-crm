'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { defaultBlocksFor } from '@/app/(dashboard)/branding/blocks/defaults';
import { buildPublicBranding } from '@/lib/branding/public-branding';

import { DEMO_EVENT_ID, FIXTURES } from './fixtures';

/**
 * A React Query cache pre-seeded with fixture data, for composites that
 * would otherwise fetch from Supabase.
 *
 * The showroom is dev-only and `npm run dev` points at the REMOTE
 * Supabase, so an un-seeded query here would hit production data. Two
 * defences, and both matter:
 *
 * 1. The composites' own query keys are seeded below, and
 *    `refetchOnMount` is off, so those `queryFn`s never run.
 * 2. Anything rendered through {@link ReadOnlyPreview} has pointer
 *    events disabled and is `inert`, so no mutation can be triggered by
 *    a stray click.
 *
 * Defence 2 is the one that actually matters. Nested lookup hooks are
 * NOT all seeded (the task list's statuses / priorities / types and the
 * branding logo still fetch), so opening this page does issue reads
 * against the remote database as whoever is signed in. Those are GETs
 * scoped by RLS to that user's own rows. Nothing here ever writes.
 *
 * @module app/design-system/mock-providers
 */

/** Branding payload shaped like `useCurrentBranding`'s return value. */
function brandingFor(surface: 'invoice' | 'contract') {
  return {
    branding: buildPublicBranding({}),
    blocks: defaultBlocksFor(surface),
    brandLabel: 'Demo Brand Kit',
  };
}

/** Builds the seeded client. Called once per mount via lazy state init. */
function createSeededClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        // The seed is the only source of truth here. Without these the
        // composites would refetch on mount and reach the real database.
        retry: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
      },
    },
  });

  const seed: [readonly unknown[], unknown][] = [
    [['event-timeline', DEMO_EVENT_ID], FIXTURES.timelineItems],
    [['event-share', DEMO_EVENT_ID], FIXTURES.eventShare],
    [['event-tasks', DEMO_EVENT_ID], FIXTURES.tasks],
    [['event-contacts', DEMO_EVENT_ID], FIXTURES.eventContacts],
    [['all-couples-for-invoice'], FIXTURES.couples],
    [['all-couples-for-contract'], FIXTURES.couples],
    [['contract-templates'], FIXTURES.contractTemplates],
    [['builder-apply-sources', true], FIXTURES.applySources],
    [['builder-apply-sources', false], FIXTURES.applySources],
    [['current-branding', 'invoice'], brandingFor('invoice')],
    [['current-branding', 'contract'], brandingFor('contract')],
    [['time-categories'], FIXTURES.timeCategories],
  ];

  for (const [key, value] of seed) client.setQueryData(key, value);
  return client;
}

/** Wraps children in the seeded query cache. */
export function MockProviders({ children }: { children: ReactNode }) {
  const [client] = useState(createSeededClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
