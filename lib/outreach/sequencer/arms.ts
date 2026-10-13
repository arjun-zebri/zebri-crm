/**
 * Channel experiment arms: which sequences can a prospect enter, and
 * which one do they get?
 *
 * An arm is eligible only when the prospect has every channel it uses,
 * so "email-only" vs "IG-first" stays a fair comparison instead of
 * silently dropping steps for some people. Among eligible arms the pick
 * is weighted-random, which is what makes the comparison an experiment.
 *
 * Pure: `random` is injected.
 *
 * @module lib/outreach/sequencer/arms
 */

/** Delivery channel of a step. */
export type Channel = 'email' | 'instagram';

/** What the arm logic needs to know about a prospect. */
export interface ChannelAvailability {
  /** Has an email that passed the free check, hasn't bounced, and wasn't scraped unconfirmed. */
  email: boolean;
  /** Has an IG handle that isn't known to be private or missing. */
  instagram: boolean;
}

/** A campaign arm with the channels its steps use. */
export interface Arm {
  sequenceId: string;
  weight: number;
  channels: Channel[];
}

/** Arms whose every channel the prospect can receive. */
export function eligibleArms(arms: Arm[], available: ChannelAvailability): Arm[] {
  return arms.filter((a) => a.weight > 0 && a.channels.length > 0 && a.channels.every((c) => available[c]));
}

/** Weighted-random choice; null when nothing has positive weight. */
export function pickWeighted<T extends { weight: number }>(items: T[], random: () => number = Math.random): T | null {
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  if (total <= 0) return null;
  let r = random() * total;
  for (const item of items) {
    r -= Math.max(0, item.weight);
    if (r < 0) return item;
  }
  return items[items.length - 1] ?? null;
}

/** Channel availability from stored prospect fields. */
export function availabilityOf(p: {
  email: string | null;
  email_check: string;
  /** Who put the address in. A scraped ('found') one is a suggestion until the founder confirms it. */
  email_source?: string | null;
  instagram_handle: string | null;
  ig_status: string | null;
}): ChannelAvailability {
  return {
    // Why: a scraped address may belong to a third party, so it never counts as a channel.
    email: !!p.email && p.email_check === 'ok' && p.email_source !== 'found',
    instagram: !!p.instagram_handle && p.ig_status !== 'private' && p.ig_status !== 'not_found',
  };
}
