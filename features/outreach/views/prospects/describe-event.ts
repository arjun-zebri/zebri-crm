/**
 * Turns one stored timeline event into a plain English sentence.
 *
 * Pure on purpose: the drawer timeline and any future Today row call
 * the same function, so one event always reads the same way everywhere.
 *
 * @module features/outreach/views/prospects/describe-event
 */
import type { OutreachEvent } from '@/lib/outreach/types';

import { CHANNEL_LABELS, EMAIL_CHECK_LABELS, LOST_REASON_LABELS, REASON_LABELS, VERDICT_LABELS, humanize, payloadString, stageLabel } from './labels';

/** The number out of a `step` payload field, when it is one. */
function payloadStep(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const step = (payload as Record<string, unknown>).step;
  return typeof step === 'number' ? ` (step ${step})` : '';
}

/** Verdict change, with the reason as words. "manual" reads as "set by you". */
function describeVerdict(payload: unknown): string {
  const to = payloadString(payload, 'to');
  const reason = payloadString(payload, 'reason');
  const verdict = (to && VERDICT_LABELS[to]) ?? 'Updated';
  if (!reason) return `Marked ${verdict.toLowerCase()}`;
  const why = REASON_LABELS[reason] ?? humanize(reason);
  return `Marked ${verdict.toLowerCase()} (${why.charAt(0).toLowerCase()}${why.slice(1)})`;
}

/** Contact found by a check run, naming the field it filled. */
function describeContact(payload: unknown): string {
  const field = payloadString(payload, 'field');
  const value = payloadString(payload, 'value');
  if (field === 'email') return 'Found email on website';
  if (field === 'instagram') return value ? `Found Instagram account ${value.startsWith('@') ? value : `@${value}`}` : 'Found Instagram account';
  if (field === 'facebook') return 'Found Facebook page';
  return 'Found a contact';
}

/** Reply, by whichever channel carried it. Admin-marked replies say so. */
function describeReply(event: OutreachEvent): string {
  const channel = event.channel ? (CHANNEL_LABELS[event.channel] ?? humanize(event.channel)) : null;
  if (event.actor === 'admin') return channel ? `Marked replied on ${channel}` : 'Marked replied';
  const snippet = payloadString(event.payload, 'snippet');
  const head = channel ? `Replied by ${channel.toLowerCase()}` : 'Replied';
  return snippet ? `${head}: “${snippet}”` : head;
}

/** Opt-out, with the source when the event recorded one. */
function describeOptOut(payload: unknown): string {
  const source = payloadString(payload, 'source');
  if (source === 'reply') return 'Opted out after replying';
  if (source === 'link') return 'Opted out from the email link';
  return 'Opted out';
}

/** Manual contact the founder logged, with its note when there is one. */
function describeTouch(payload: unknown): string {
  const kind = payloadString(payload, 'kind');
  const note = payloadString(payload, 'note');
  const label = kind === 'call' ? 'a call' : kind === 'email' ? 'an email' : kind === 'ig_comment' ? 'an Instagram comment' : kind === 'ig_reply' ? 'an Instagram reply' : 'a contact';
  return note ? `Logged ${label}: ${note}` : `Logged ${label}`;
}

/** Email verification result, in words. */
function describeEmailCheck(payload: unknown): string {
  const result = payloadString(payload, 'result');
  if (!result || result === 'ok') return 'Email address checked, looks deliverable';
  return `Email address checked: ${EMAIL_CHECK_LABELS[result] ?? humanize(result)}`;
}

/**
 * One sentence for a timeline event. Unknown or future event types fall
 * back to a humanised type name, so the timeline never shows raw codes
 * as a crash or an empty row.
 *
 * @param event A row from `outreach_events`.
 * @returns A short sentence with no trailing full stop.
 */
export function describeEvent(event: OutreachEvent): string {
  const p = event.payload;
  switch (event.type) {
    case 'imported': return payloadString(p, 'source') === 'manual' ? 'Added by you' : 'Added from the sheet';
    case 'merged': return 'Merged with a new sheet row';
    case 'check_completed': {
      const score = p && typeof p === 'object' ? (p as Record<string, unknown>).score : null;
      return typeof score === 'number' ? `Activity check finished (activity ${score} of 100)` : 'Activity check finished';
    }
    case 'verdict_changed': return describeVerdict(p);
    case 'contact_found': return describeContact(p);
    case 'email_checked': return describeEmailCheck(p);
    case 'ig_lookup_skipped_budget':
      return payloadString(p, 'reason') === 'apify_not_configured'
        ? 'Instagram lookup skipped, lookup key not set in Vercel'
        : 'Instagram lookup skipped, monthly budget reached';
    case 'enrolled': return 'Added to a sequence';
    case 'message_scheduled': return `${event.channel === 'instagram' ? 'Instagram DM' : 'Email'} scheduled${payloadStep(p)}`;
    case 'message_skipped': {
      const reason = payloadString(p, 'reason');
      return reason ? `Message skipped: ${humanize(reason).toLowerCase()}` : 'Message skipped';
    }
    case 'email_sent': return `Email sent${payloadStep(p)}`;
    case 'email_failed': {
      const error = payloadString(p, 'error');
      return error ? `Email failed to send: ${error}` : 'Email failed to send';
    }
    case 'email_bounced': return 'Email bounced';
    case 'ig_copied': return 'Instagram message copied';
    case 'ig_sent': return `Instagram DM sent${payloadStep(p)}`;
    case 'ig_skipped': {
      const reason = payloadString(p, 'reason');
      return reason ? `Instagram DM skipped: ${reason}` : 'Instagram DM skipped';
    }
    case 'ig_cant_dm': return "Can't DM this one on Instagram";
    case 'replied': return describeReply(event);
    case 'auto_reply_received': return 'Auto-reply received (out of office)';
    case 'opted_out': return describeOptOut(p);
    case 'opt_out_undone': return 'Opt-out undone by you';
    case 'stage_changed': {
      const from = payloadString(p, 'from');
      const to = payloadString(p, 'to');
      if (!to) return 'Stage changed';
      const move = from ? `${stageLabel(from)} to ${stageLabel(to)}` : stageLabel(to);
      return event.actor === 'admin' ? `Stage set: ${move}` : `Moved ${move}`;
    }
    case 'sentiment_set': {
      const s = payloadString(p, 'sentiment');
      return s ? `Reply marked ${s}` : 'Reply sentiment cleared';
    }
    case 'note_added': return 'Note saved';
    case 'manual_touch': return describeTouch(p);
    case 'demo_booked': return p && typeof p === 'object' && (p as { needs_confirmation?: unknown }).needs_confirmation === true
      ? 'Someone booked a call using this email. Check it was them, then set the stage.'
      : 'Demo booked';
    case 'demo_cancelled': return 'Demo cancelled';
    case 'demo_done': return 'Demo done';
    case 'signed_up': return 'Signed up for Zebri';
    case 'paying': return 'Started paying';
    case 'sequence_stopped': {
      const reason = payloadString(p, 'reason');
      return reason ? `Sequence stopped (${humanize(reason).toLowerCase()})` : 'Sequence stopped';
    }
    case 'linked_user': return 'Linked to a Zebri account';
    default: return humanize(event.type);
  }
}

/** Lost-reason label, re-exported so the drawer and timeline share one source. */
export function lostReasonLabel(code: string): string {
  return (LOST_REASON_LABELS as Record<string, string>)[code] ?? humanize(code);
}
