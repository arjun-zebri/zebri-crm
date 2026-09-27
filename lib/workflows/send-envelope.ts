/**
 * The envelope of a held send: who it is from, who it goes to, where
 * replies land, when it goes and what is attached.
 *
 * Shown above the rendered email in the step detail modal, so the MC
 * reads the whole of what they are approving, not just the words. It is
 * only worth reading if it agrees with the send, so every decision here
 * is made by the function the send itself calls:
 *
 * - the sender by `describeSender`, which decides through the same
 *   `chooseSender` as the send's `resolveSender`;
 * - the recipients by `resolveRecipients`, `resolveCopyCandidates` and
 *   `planRecipients` (primary, spouse, the cc/bcc split into separate
 *   messages, the MC's own copy, also a separate message);
 * - who is left out by `gateOptOuts` (the couple's opt-out flag and the
 *   suppression list), shown as skipped with the reason;
 * - the reply-to and attachment set by `sendReplyTo`,
 *   `sendAttachmentIds` and `listAttachmentFiles`;
 * - the config itself by the send's own `sendEmailConfigSchema`, so the
 *   defaults match too.
 *
 * Read-only. It runs through the MC's own RLS client and never mints,
 * refreshes, writes or counts anything toward the send cap.
 *
 * @module lib/workflows/send-envelope
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { sendEmailConfigSchema } from '@/lib/automations/actions/messaging';
import { resolveRecipients } from '@/lib/automations/recipients';
import { isTransactionalSend } from '@/lib/email/commercial-classification';
import { listAttachmentFiles } from '@/lib/email/send-context';
import {
  gateOptOuts,
  planRecipients,
  resolveCopyCandidates,
  sendAttachmentIds,
  sendReplyTo,
  type OptOutReason,
} from '@/lib/email/send-email-plan';
import { describeSender, type SenderChoice } from '@/lib/email/sender-identity';
import type { ResolvedRecipient, RunContext } from '@/types/automations';
import type { Database } from '@/types/database';
import type { WorkflowStepRow } from '@/types/workflows';

import { DEFAULT_MC_TIMEZONE, loadMcTimezone } from './mc-timezone';

/** One address on the envelope's To line. */
export interface EnvelopeRecipient {
  /** The person's name, or null when all we have is the address. */
  name: string | null;
  email: string;
  /** A cc or bcc address mailed as its own message. */
  copy: boolean;
  /** Why this address gets nothing, or null when it is mailed. */
  skipped: OptOutReason | null;
}

/** When the send goes. */
export type EnvelopeSendTime =
  | { kind: 'now' }
  /** A future time, already formatted in the MC's timezone. */
  | { kind: 'at'; label: string; timeZone: string }
  /** Waiting on the step before it, so it has no time yet. */
  | { kind: 'unscheduled' }
  /** Parked by the send until a missing detail is filled in. */
  | { kind: 'held' };

/** Everything around the message. See the module comment. */
export interface SendEnvelope {
  /** The From header exactly as the send sets it. */
  from: string;
  fromName: string | null;
  fromAddress: string;
  /** Through the shared Zebri address or the MC's own mailbox. */
  via: 'zebri' | 'gmail' | 'outlook';
  /** Everyone the step addresses, in send order, the skipped included. */
  to: EnvelopeRecipient[];
  /**
   * Where the MC's own copy goes, as its own email after the couple's
   * (never a bcc on theirs), or null when there is none.
   */
  mcCopy: string | null;
  replyTo: string | null;
  /** Null once the step has run or been dropped. */
  sendAt: EnvelopeSendTime | null;
  /** Attached file names. */
  attachments: string[];
  /** Variables the message could not fill, by readable label. */
  unresolved: string[];
  /**
   * Variables Zebri does not know at all, by path (`event.venue`). No
   * detail on the couple can fill them, so the envelope tells the MC to
   * edit the message instead (live check B7). Absent means none.
   */
  unknown?: string[];
  /**
   * The engine's rule for those gaps: true when the send will not go
   * until they are filled (a rich-text body parks), false when it goes
   * with them blank (a legacy plain-text body).
   */
  unresolvedHolds: boolean;
  /**
   * The step has run, been skipped or been cancelled. Who it reached is
   * history (the couple's Emails tab has it), so no sender or recipients
   * are worked out: today's contacts and opt-outs would misreport it.
   * Only {@link SendEnvelope.notice} is meant to be shown.
   */
  settled: boolean;
  /** Something the MC should know instead of, or beside, the To line. */
  notice: string | null;
}

/** Inputs to {@link buildSendEnvelope}. */
export interface SendEnvelopeInput {
  /** The MC's own RLS client. */
  supabase: SupabaseClient<Database>;
  step: WorkflowStepRow;
  ctx: RunContext;
  /** The config as approving would leave it (edits applied). */
  config: Record<string, unknown>;
  /** Files the named saved template carries, already read. */
  templateFileIds: string[];
  /** From the rendered preview. */
  unresolved: string[];
  /** From the rendered preview: variables Zebri does not know. */
  unknown?: string[];
  /** From the rendered preview: whether those gaps park the send. */
  unresolvedHolds: boolean;
  now?: Date;
}

/** Build the envelope for one `send_email` step. Read-only. */
export async function buildSendEnvelope(input: SendEnvelopeInput): Promise<SendEnvelope> {
  const { supabase, step, ctx } = input;
  const settled = SETTLED_NOTICE[step.status];
  if (settled) {
    return {
      from: '',
      fromName: null,
      fromAddress: '',
      via: 'zebri',
      to: [],
      mcCopy: null,
      replyTo: null,
      sendAt: null,
      attachments: [],
      unresolved: [],
      unresolvedHolds: false,
      settled: true,
      notice: settled,
    };
  }
  const [sender, timeZone] = await Promise.all([
    describeSender(supabase, ctx.userId, ctx.mc.businessName),
    loadMcTimezone(supabase, ctx.userId),
  ]);
  const base: SendEnvelope = {
    ...senderParts(sender),
    to: [],
    mcCopy: null,
    replyTo: null,
    sendAt: sendTimeFor(step, timeZone, input.now ?? new Date()),
    attachments: [],
    unresolved: input.unresolved,
    unknown: input.unknown ?? [],
    unresolvedHolds: input.unresolvedHolds,
    settled: false,
    notice: null,
  };

  const parsed = sendEmailConfigSchema.safeParse(input.config);
  if (!parsed.success) {
    return { ...base, notice: 'This step’s settings are incomplete, so it will stop with an error.' };
  }
  const config = parsed.data;
  const files = await listAttachmentFiles(
    supabase,
    sendAttachmentIds(input.templateFileIds, config.attachFiles),
  );
  const withMeta: SendEnvelope = {
    ...base,
    replyTo: sendReplyTo(config.replyToOverride, ctx.mc.email) || null,
    attachments: files.map((f) => f.file_name),
  };
  if (!ctx.couple) return { ...withMeta, notice: 'This step has no couple to send to.' };

  let recipients: ResolvedRecipient[];
  try {
    recipients = await resolveRecipients(supabase, ctx.couple, config.recipients, ctx.mc);
  } catch {
    // The spec's `error` fallback throws when nobody matches; the send
    // then errors the step.
    return { ...withMeta, notice: 'No one matches who this step sends to, so it will stop with an error.' };
  }
  const nobody = { ...withMeta, notice: 'No one to send this to, so this step will be skipped.' };
  if (recipients.length === 0) return nobody;

  const { ccCandidates, typedBcc } = await resolveCopyCandidates(supabase, ctx.couple, config);
  const plan = planRecipients({
    recipients,
    ccCandidates,
    typedBcc,
    bccSelf: Boolean(config.bccSelf),
    mcEmail: ctx.mc.email,
    // Constant for send_email (it is commercial), asked the same way the
    // send asks so a reclassification moves both.
    commercial: !isTransactionalSend('send_email'),
  });
  if (plan.addressable.length === 0) return nobody;

  const gate = await gateOptOuts(supabase, ctx.userId, ctx.couple.id, plan.addressable);
  const skipped = new Map(gate.status === 'ok' ? gate.skipped.map((s) => [s.recipient, s.reason]) : []);
  return {
    ...withMeta,
    mcCopy: plan.mcCopy,
    to: plan.addressable.map((r) => ({
      name: r.name && r.name !== r.email ? r.name : null,
      email: r.email!,
      copy: plan.copyRecipients.includes(r),
      skipped: skipped.get(r) ?? null,
    })),
    notice:
      gate.status === 'unknown'
        ? 'Could not check who has unsubscribed just now. The send checks again before anything goes.'
        : null,
  };
}

/** What an edit to a held send's wording can change on its envelope. */
export type EnvelopePatch = Pick<SendEnvelope, 'attachments' | 'unresolved' | 'unknown' | 'unresolvedHolds'>;

/**
 * The part of the envelope an edit can change, for an edited preview.
 *
 * The MC's edits replace only the subject and the message
 * (`applyReviewEdits`), which can change which variables are unfilled
 * and, since an edit drops a saved template, which files go with it.
 * Nothing else on the envelope reads the wording, so an edited preview
 * re-reads just the attachment names and the detail modal keeps the
 * saved envelope's sender, recipients and time. The full envelope costs
 * a sender read, the recipients and one suppression check per recipient,
 * on every debounced keystroke burst (Task 29 review M5).
 *
 * Read-only, through the MC's own RLS client.
 */
export async function buildEnvelopePatch(
  input: Pick<SendEnvelopeInput, 'supabase' | 'config' | 'templateFileIds' | 'unresolved' | 'unknown' | 'unresolvedHolds'>,
): Promise<EnvelopePatch> {
  const parsed = sendEmailConfigSchema.safeParse(input.config);
  const files = parsed.success
    ? await listAttachmentFiles(input.supabase, sendAttachmentIds(input.templateFileIds, parsed.data.attachFiles))
    : [];
  return {
    attachments: files.map((f) => f.file_name),
    unresolved: input.unresolved,
    unknown: input.unknown ?? [],
    unresolvedHolds: input.unresolvedHolds,
  };
}

/**
 * What a finished step's envelope says instead of recipients. Keyed by
 * status; a status not listed is still live. Shared with the pre-composed
 * envelope (`./precomposed-envelope`).
 */
export const SETTLED_NOTICE: Partial<Record<WorkflowStepRow['status'], string>> = {
  done: 'This step has run. The couple’s Emails tab lists who it reached.',
  skipped: 'This step was skipped, so nothing was sent.',
  cancelled: 'This step was cancelled, so nothing was sent.',
};

/** The From header as a name and an address, plus the transport. */
export function senderParts(sender: SenderChoice): Pick<SendEnvelope, 'from' | 'fromName' | 'fromAddress' | 'via'> {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(sender.from);
  const via =
    sender.transport === 'resend' ? 'zebri' : sender.provider === 'google' ? 'gmail' : 'outlook';
  return {
    from: sender.from,
    fromName: match?.[1] ? match[1] : null,
    fromAddress: match?.[2] ?? sender.from,
    via,
  };
}

/**
 * When a step's send goes, in the MC's timezone.
 *
 * A step that has run, been skipped or been cancelled has no send time.
 * An errored step goes when the MC presses Try again, so it reads as
 * now. Pending and waiting steps go at `due_at`, or now once that has
 * passed; with no `due_at` they are waiting on the step before them.
 */
export function sendTimeFor(step: WorkflowStepRow, timeZone: string, now: Date): EnvelopeSendTime | null {
  if (step.status === 'done' || step.status === 'skipped' || step.status === 'cancelled') return null;
  if (step.status === 'errored' || step.status === 'running') return { kind: 'now' };
  if (!step.due_at) return { kind: 'unscheduled' };
  const due = new Date(step.due_at);
  if (due.getTime() <= now.getTime()) return { kind: 'now' };
  // A send parked on missing variables sleeps until the year 9999: held
  // until the MC fills the gap, not a date to show, and not waiting on
  // any other step.
  if (due.getUTCFullYear() >= 9999) return { kind: 'held' };
  return { kind: 'at', label: formatInZone(due, timeZone), timeZone };
}

/** "Thu 10 Sept, 4:00 pm AWST", falling back to the default zone. */
function formatInZone(date: Date, timeZone: string): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  };
  try {
    return new Intl.DateTimeFormat('en-AU', { ...options, timeZone }).format(date);
  } catch {
    // An unrecognised saved zone throws here. The default zone keeps the
    // label readable rather than taking the whole envelope down.
    return new Intl.DateTimeFormat('en-AU', { ...options, timeZone: DEFAULT_MC_TIMEZONE }).format(date);
  }
}
