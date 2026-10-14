/**
 * Shared outreach types, derived from the generated database types so
 * the domain and the schema can't drift apart.
 *
 * @module lib/outreach/types
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

type Tables = Database['public']['Tables'];

/** Service-role client typed against the schema. */
export type AdminDb = SupabaseClient<Database>;

/** A stored prospect. */
export type Prospect = Tables['outreach_prospects']['Row'];
/** Insert shape for a prospect. */
export type ProspectInsert = Tables['outreach_prospects']['Insert'];
/** Patch shape for a prospect. */
export type ProspectUpdate = Tables['outreach_prospects']['Update'];
/** A check run. */
export type CheckRun = Tables['outreach_check_runs']['Row'];
/** One queued or finished check. */
export type CheckRow = Tables['outreach_checks']['Row'];
/** A sequence. */
export type Sequence = Tables['outreach_sequences']['Row'];
/** A sequence step. */
export type SequenceStep = Tables['outreach_sequence_steps']['Row'];
/** A template variant. */
export type Variant = Tables['outreach_variants']['Row'];
/** A campaign. */
export type Campaign = Tables['outreach_campaigns']['Row'];
/** A campaign arm. */
export type CampaignArm = Tables['outreach_campaign_arms']['Row'];
/** An enrolment. */
export type Enrollment = Tables['outreach_enrollments']['Row'];
/** A scheduled or sent message. */
export type OutreachMessage = Tables['outreach_messages']['Row'];
/** A timeline event. */
export type OutreachEvent = Tables['outreach_events']['Row'];
/** The settings row. */
export type OutreachSettings = Tables['outreach_settings']['Row'];

/** Pipeline stages, in funnel order. */
export const STAGES = [
  'new', 'contacted', 'replied', 'demo_booked', 'demo_done', 'signed_up', 'paying', 'lost', 'opted_out',
] as const;

/** One of {@link STAGES}. */
export type Stage = (typeof STAGES)[number];

/** Forward-only stages that automation may advance through. */
const FUNNEL: Stage[] = ['new', 'contacted', 'replied', 'demo_booked', 'demo_done', 'signed_up', 'paying'];

/**
 * True when automation may move a prospect from `from` to `to`: only
 * forward along the funnel, and never out of `lost` / `opted_out`
 * (those are the founder's or the recipient's call).
 */
export function canAutoAdvance(from: Stage, to: Stage): boolean {
  if (from === 'opted_out') return false;
  if (from === 'lost') return to === 'demo_booked' || to === 'signed_up' || to === 'paying';
  const a = FUNNEL.indexOf(from);
  const b = FUNNEL.indexOf(to);
  return a !== -1 && b !== -1 && b > a;
}

/** Lost reasons, as stored. */
export const LOST_REASONS = [
  'not_interested', 'no_longer_celebrant', 'has_crm', 'price', 'bad_timing', 'no_response', 'other',
] as const;

/** Event types written to `outreach_events`. */
export type EventType =
  | 'imported' | 'merged' | 'check_completed' | 'verdict_changed' | 'contact_found' | 'email_checked'
  | 'ig_lookup_skipped_budget' | 'enrolled' | 'message_scheduled' | 'message_skipped' | 'email_sent'
  | 'email_failed' | 'email_bounced' | 'ig_copied' | 'ig_sent' | 'ig_skipped' | 'ig_cant_dm'
  | 'replied' | 'auto_reply_received' | 'opted_out' | 'opt_out_undone' | 'stage_changed' | 'sentiment_set' | 'note_added'
  | 'manual_touch' | 'demo_booked' | 'demo_cancelled' | 'demo_done' | 'signed_up' | 'paying'
  | 'sequence_stopped' | 'linked_user';
