/**
 * Workflows page (server orchestrator).
 *
 * Replaces both the Tasks board and the Automations list. Two tabs: the
 * Queue (steps due across every couple, the MC's daily view) and the
 * template library.
 *
 * Orchestrator only. It resolves the tab from the query string and hands
 * off; every fetch and mutation lives in the client components and their
 * hooks.
 *
 * @module app/(dashboard)/workflows/page
 */
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { WorkflowsClient, type WorkflowsTab } from './workflows-client';

export default async function WorkflowsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // The queue's relative due labels ("3 days ago") are local-date
  // calculations, so the MC's zone has to reach the client. Defaults to
  // Sydney, matching the rest of the app.
  const { data: settings } = await supabase
    .from('user_public_settings')
    .select('timezone')
    .eq('user_id', user.id)
    .maybeSingle();
  const timezone = settings?.timezone ?? 'Australia/Sydney';

  const { tab } = await searchParams;
  // Templates is reachable by link (the retired /automations route lands
  // there); anything unrecognised falls back to the daily view.
  const initialTab: WorkflowsTab = tab === 'templates' ? 'templates' : 'queue';

  return <WorkflowsClient initialTab={initialTab} timezone={timezone} />;
}
