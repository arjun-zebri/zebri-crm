/**
 * What a held pre-composed email sends, and to whom.
 *
 * `send_email` is previewed in full: the MC reads the rendered message
 * and its envelope before approving (`./review`, `./send-envelope`). The
 * other email actions (portal link, questionnaire, contract, invoice,
 * run sheet, post-event notes) compose their wording inside their own
 * handlers, and nothing renders it outside the send yet. Showing only the
 * action's label at approval let an MC approve a branded email they had
 * never seen without saying so (Phase 5 review, I3).
 *
 * The ruling for this branch: say plainly what the email is, who it goes
 * to and from where, and that its preview is not available yet. Previewing
 * these through their handlers' own renderers, for full parity, is an
 * owner ticket (see email-system.md, "Owner tickets").
 *
 * The recipients follow each handler's own rule (the couple's primary
 * address; the vendors, couple and MC as a run-sheet step's toggles say).
 * Who is opted out is not worked out here: every one of these sends goes
 * through the send gate, which checks again before anything goes.
 *
 * Read-only, through the MC's own RLS client.
 *
 * @module lib/workflows/precomposed-envelope
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { resolveRecipients } from '@/lib/automations/recipients';
import { AUTOMATION_FROM } from '@/lib/email/automation-send';
import { describeSender, type SenderChoice } from '@/lib/email/sender-identity';
import type { ActionType, RunContext } from '@/types/automations';
import type { Database } from '@/types/database';
import type { WorkflowStepRow } from '@/types/workflows';

import { loadMcTimezone } from './mc-timezone';
import { PREVIEW_UNAVAILABLE } from './precomposed-copy';
import {
  senderParts,
  sendTimeFor,
  SETTLED_NOTICE,
  type EnvelopeRecipient,
  type SendEnvelope,
} from './send-envelope';


/** Who one pre-composed email goes to, from its step config. */
interface Audience {
  couple: boolean;
  vendors: boolean;
  mc: boolean;
}

/** One pre-composed email action: what it sends and how it addresses it. */
interface PrecomposedEmail {
  /** What the email is, in the MC's words. */
  sends: string;
  /** Sent through the MC's connected mailbox when they have one. */
  fromMailbox: boolean;
  /** The recipients, as the handler decides them. */
  audience: (config: Record<string, unknown>) => Audience;
}

/** The couple's primary address, as every single-recipient handler sends. */
const COUPLE_ONLY = (): Audience => ({ couple: true, vendors: false, mc: false });

/**
 * The run-sheet sends' toggles, with the handler schema's own defaults:
 * vendors on, the couple and the MC off.
 */
const RUN_SHEET_AUDIENCE = (config: Record<string, unknown>): Audience => ({
  vendors: config['sendToVendors'] !== false,
  couple: config['sendToCouple'] === true,
  mc: config['sendToMe'] === true,
});

/**
 * Every pre-composed email action. Mirrors the handlers in
 * `lib/automations/actions`: which ones send from the MC's mailbox
 * (`resolveStepSender`) and who each one mails. A new email action with
 * no entry here previews as its label alone, as before.
 */
const PRECOMPOSED: Partial<Record<ActionType, PrecomposedEmail>> = {
  send_portal_link: { sends: 'A link to their client portal', fromMailbox: false, audience: COUPLE_ONLY },
  request_information: { sends: 'A request for the details still missing', fromMailbox: false, audience: COUPLE_ONLY },
  send_couple_questionnaire: { sends: 'A questionnaire for them to fill in', fromMailbox: true, audience: COUPLE_ONLY },
  send_contract: { sends: 'Their contract, with a link to sign it', fromMailbox: true, audience: COUPLE_ONLY },
  send_invoice: { sends: 'Their invoice, with a link to pay it', fromMailbox: true, audience: COUPLE_ONLY },
  trigger_payment_reminder: { sends: 'A payment reminder with their invoice link', fromMailbox: true, audience: COUPLE_ONLY },
  generate_run_sheet_pdf: {
    sends: 'A link to the run sheet',
    fromMailbox: true,
    audience: (config) => ({ couple: config['sendToCouple'] === true, vendors: false, mc: true }),
  },
  send_timeline_to_vendors: { sends: 'A link to the run sheet', fromMailbox: false, audience: RUN_SHEET_AUDIENCE },
  send_final_run_sheet: { sends: 'A link to the final run sheet', fromMailbox: false, audience: RUN_SHEET_AUDIENCE },
  send_onboarding_pack: { sends: 'A welcome email on what happens next', fromMailbox: false, audience: COUPLE_ONLY },
  send_pre_event_checklist: { sends: 'A countdown checklist for the day', fromMailbox: false, audience: COUPLE_ONLY },
  send_thank_you_message: { sends: 'A thank-you note after the day', fromMailbox: false, audience: COUPLE_ONLY },
  request_review: { sends: 'A request for a review', fromMailbox: false, audience: COUPLE_ONLY },
  send_referral_request: { sends: 'A request for referrals', fromMailbox: false, audience: COUPLE_ONLY },
  send_anniversary_message: { sends: 'An anniversary note', fromMailbox: false, audience: COUPLE_ONLY },
};

/** What this action's email is, or null when it is not a pre-composed email. */
export function precomposedEmail(actionType: string | null): string | null {
  return actionType ? (PRECOMPOSED[actionType as ActionType]?.sends ?? null) : null;
}

/**
 * The envelope for a held pre-composed email: From, To and When, and the
 * {@link PREVIEW_UNAVAILABLE} line. Null when `actionType` is not one.
 */
export async function buildPrecomposedEnvelope(input: {
  supabase: SupabaseClient<Database>;
  step: WorkflowStepRow;
  ctx: RunContext;
  actionType: string;
  config: Record<string, unknown>;
  now?: Date;
}): Promise<SendEnvelope | null> {
  const spec = PRECOMPOSED[input.actionType as ActionType];
  if (!spec) return null;
  const { supabase, step, ctx } = input;
  const empty: SendEnvelope = {
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
    settled: false,
    notice: PREVIEW_UNAVAILABLE,
  };
  const settled = SETTLED_NOTICE[step.status];
  if (settled) return { ...empty, settled: true, notice: settled };

  const shared: SenderChoice = { transport: 'resend', from: AUTOMATION_FROM };
  const [sender, timeZone] = await Promise.all([
    spec.fromMailbox ? describeSender(supabase, ctx.userId, ctx.mc.businessName) : Promise.resolve(shared),
    loadMcTimezone(supabase, ctx.userId),
  ]);

  const audience = spec.audience(input.config);
  const to: EnvelopeRecipient[] = [];
  const seen = new Set<string>();
  const add = (name: string | null, email: string | null | undefined) => {
    const key = email?.trim().toLowerCase();
    if (!email || !key || seen.has(key)) return;
    seen.add(key);
    to.push({ name: name && name !== email ? name : null, email, copy: false, skipped: null });
  };
  if (audience.vendors && ctx.couple) {
    const vendors = await resolveRecipients(supabase, ctx.couple, { roles: ['vendor'], fallback: 'skip' });
    for (const v of vendors) add(v.name, v.email);
  }
  if (audience.couple && ctx.couple) add(ctx.couple.primaryName ?? ctx.couple.name, ctx.couple.email);
  if (audience.mc) add('You', ctx.mc.email);

  return {
    ...empty,
    ...senderParts(sender),
    to,
    sendAt: sendTimeFor(step, timeZone, input.now ?? new Date()),
    notice: to.length === 0 ? `No one to send this to, so this step will be skipped. ${PREVIEW_UNAVAILABLE}` : PREVIEW_UNAVAILABLE,
  };
}
