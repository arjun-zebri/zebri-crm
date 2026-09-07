/**
 * What the time-based emitters need to know: which trigger configs are
 * live, and for whom.
 *
 * An emitter like `invoice_due` has no source row that changes when it
 * fires, so each tick it has to compute "what should fire now". Doing
 * that for every possible lead time would publish events nothing
 * matches, so the emitters first ask which lead times anyone actually
 * configured.
 *
 * Before the cutover that question was answered by `automations`. It is
 * now answered by active workflow templates whose apply rule is
 * `on_event`: their `apply_rule_config` carries the event type and the
 * trigger config the old row held, which is exactly what the converter
 * wrote for every automation it migrated.
 *
 * @module lib/workflows/trigger-configs
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

/** One live trigger config, in the shape the emitters already speak. */
export interface ActiveTriggerConfig {
  user_id: string;
  trigger_config: unknown;
}

/**
 * Every live config for one bus event type, across all users.
 *
 * @param supabase - a service-role client; this runs from the cron tick
 * @param eventType - the bus event slug, e.g. `invoice_due`
 */
export async function loadActiveTriggerConfigs(
  supabase: SupabaseClient<Database>,
  eventType: string,
): Promise<ActiveTriggerConfig[]> {
  const { data, error } = await supabase
    .from('workflow_templates')
    .select('user_id, apply_rule_config')
    .eq('status', 'active')
    .eq('apply_rule_type', 'on_event')
    // The event type lives inside the jsonb rule config, so the filter
    // has to reach into it. `->>` keeps this an index-friendly text
    // comparison rather than a jsonb containment scan.
    .eq('apply_rule_config->>eventType', eventType);

  if (error) {
    throw new Error(`load ${eventType} workflow templates: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    user_id: row.user_id,
    trigger_config:
      (row.apply_rule_config as { triggerConfig?: unknown } | null)?.triggerConfig ?? {},
  }));
}
