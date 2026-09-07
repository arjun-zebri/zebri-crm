/**
 * How a workflow card says when it starts.
 *
 * "Starts on booking" reads to an MC; `on_event` with a nested
 * `couple_stage_changed` does not. One short phrase per apply rule,
 * derived from the same registry the builder's picker uses so the card
 * and the canvas can never disagree.
 *
 * @module app/(dashboard)/workflows/apply-rule-label
 */

import { triggerRegistry } from '@/lib/automations/triggers';
import { splitApplyRule } from '@/lib/workflows/apply-rules';
import type { Json } from '@/types/database';

/** Phrases worth saying better than the trigger registry says them. */
const OVERRIDES: Readonly<Record<string, string>> = {
  unset: 'No start rule yet',
  manual: 'You start it by hand',
  new_enquiry: 'Starts on enquiry',
  couple_stage_changed: 'Starts on a stage change',
  package_applied: 'Starts on a package',
  contract_signed: 'Starts on signing',
  invoice_paid: 'Starts on payment',
};

/**
 * The card's start line for one template.
 *
 * @param applyRuleType - the stored `apply_rule_type`
 * @param applyRuleConfig - the stored `apply_rule_config`
 */
export function applyRuleLabel(applyRuleType: string, applyRuleConfig: Json): string {
  // `manual` is checked before the adapter because `splitApplyRule`
  // deliberately reports it as `unset`: the canvas wants a "pick a start
  // rule" placeholder there. A card is not a placeholder, and "no start
  // rule yet" is wrong about a workflow the MC starts on purpose.
  if (applyRuleType === 'manual') return OVERRIDES['manual'] as string;

  const { triggerType } = splitApplyRule(applyRuleType, applyRuleConfig);
  const override = OVERRIDES[triggerType];
  if (override) return override;

  const spec = triggerRegistry[triggerType as keyof typeof triggerRegistry];
  // Lower-cased so it reads as the tail of a sentence rather than a
  // heading dropped into one.
  return spec ? `Starts on ${spec.ui.label.toLowerCase()}` : 'Starts automatically';
}
