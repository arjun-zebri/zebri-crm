/**
 * Shared seeding helpers for the emitter integration tests.
 *
 * Those tests prove the chain "something happens in the DB → an event
 * lands on the bus → the dispatcher opens work". After the cutover the
 * far end of that chain is an applied workflow instance rather than an
 * automation run, so the seeds and assertions live here instead of being
 * copy-pasted into six files.
 *
 * @module tests/integration/helpers/workflows
 */

import type { Json } from '@/types/database';

import { serviceClient } from './supabase';

/**
 * An active template that applies whenever a given bus event fires.
 *
 * Every legacy trigger keeps working through the `on_event` apply rule,
 * so this is also what a converted automation looks like.
 */
export async function seedEventTemplate(
  userId: string,
  eventType: string,
  triggerConfig: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await serviceClient()
    .from('workflow_templates')
    .insert({
      user_id: userId,
      name: eventType,
      status: 'active',
      apply_rule_type: 'on_event',
      apply_rule_config: { eventType, triggerConfig } as unknown as Json,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`seed template: ${error?.message}`);
  return data.id;
}

/** The instances the dispatcher opened for a template. */
export async function instancesFor(templateId: string): Promise<{ id: string }[]> {
  const { data } = await serviceClient()
    .from('workflow_instances')
    .select('id')
    .eq('template_id', templateId);
  return data ?? [];
}
