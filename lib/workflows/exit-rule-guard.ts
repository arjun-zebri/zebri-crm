/**
 * The save-time check that a workflow's trigger and its exit stages do
 * not contradict each other, for every path that writes either one.
 *
 * Two server actions write one half of the pair: the builder's
 * stop-stage control (`setExitStatusesAction`) and the builder's trigger
 * (`setApplyRuleAction`). Each loads the half it is not changing from the
 * template, merges in its change, and asks {@link exitRuleConflict}. The
 * words name the MC's own stage, so the refusal reads "moves to Lost",
 * not "moves to lost". The AI copilot's `set_trigger` tool applies the
 * same pure rule through its own narrower client type
 * (`lib/workflows/ai-copilot/tool-executors`).
 *
 * @module lib/workflows/exit-rule-guard
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

import { exitRuleConflict } from './exit-rules';

/** The half of the pair a save is changing. */
export type ExitRuleChange =
  | { applyRuleType: string; applyRuleConfig: unknown }
  | { exitStatuses: readonly string[] };

/** Said when the saved half cannot be read, so the check cannot run. */
const CANNOT_CHECK = "Could not check this workflow's stop stages. Nothing was saved; try again.";

/**
 * The template's saved trigger and exit list; null when not found.
 *
 * @throws when the read itself fails, so the caller can fail closed
 */
async function loadPair(
  supabase: SupabaseClient<Database>,
  templateId: string,
): Promise<{ applyRuleType: string; applyRuleConfig: unknown; exitStatuses: string[] } | null> {
  const { data, error } = await supabase
    .from('workflow_templates')
    .select('apply_rule_type, apply_rule_config, exit_statuses')
    .eq('id', templateId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    applyRuleType: data.apply_rule_type,
    applyRuleConfig: data.apply_rule_config,
    exitStatuses: data.exit_statuses ?? [],
  };
}

/** Slug to display name over the caller's own stages. */
async function stageNamer(supabase: SupabaseClient<Database>): Promise<(slug: string) => string> {
  // The error is not checked, deliberately: this only turns slugs into
  // display names for a refusal that has already been decided. A failed
  // read shows the slug instead of the name; the save is still refused.
  const { data } = await supabase.from('couple_statuses').select('slug, name');
  const names = new Map((data ?? []).map((s) => [s.slug.toLowerCase(), s.name]));
  return (slug) => names.get(slug) ?? slug;
}

/**
 * Would this change leave the template contradicting itself?
 *
 * Reads through the caller's client, so under RLS another tenant's
 * template is simply not found.
 *
 * @param supabase - the caller's client (RLS-scoped for server actions)
 * @param templateId - the template being saved
 * @param change - the half being written; the other half is read
 * @returns `{ notFound: true }`, the refusal in the MC's words, or null.
 *   A failed read is a refusal, never a pass: skipping the check would
 *   let a contradiction through exactly when the database is unhealthy.
 */
export async function exitRuleRefusal(
  supabase: SupabaseClient<Database>,
  templateId: string,
  change: ExitRuleChange,
): Promise<{ notFound: true } | string | null> {
  let saved: Awaited<ReturnType<typeof loadPair>>;
  try {
    saved = await loadPair(supabase, templateId);
  } catch {
    return CANNOT_CHECK;
  }
  if (!saved) return { notFound: true };
  const next = { ...saved, ...change };
  // Cheap path first: most saves touch a workflow with no stop stages or
  // no stage trigger, and need no stage names at all.
  if (exitRuleConflict(next, next.exitStatuses) === null) return null;
  return exitRuleConflict(next, next.exitStatuses, await stageNamer(supabase));
}
