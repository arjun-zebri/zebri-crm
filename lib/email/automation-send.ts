/**
 * One way for an automation action to send an email, and the legal floor
 * every such send has to clear.
 *
 * Every action that mails a couple or a vendor goes through here. That
 * is not tidiness: the executor retries a failed step up to three times,
 * and an action that reaches a provider by itself reliably ends up
 * missing one of the things that makes a send safe to retry or lawful to
 * send at all.
 *
 * - **The idempotency key.** Without it, a send that timed out after the
 *   message had already gone is repeated, and the couple gets it twice
 *   more.
 * - **The result.** An awaited-and-discarded send reports success on a
 *   rejection, so the step goes green, the workflow moves on, and
 *   nothing says the couple never got it.
 * - **The retry verdict.** Whether a repeat is safe depends on whether
 *   the transport can deduplicate, which is
 *   {@link transportDeduplicates}'s answer, not the caller's guess.
 * - **The account-wide stop.** While the MC's workflow automation is
 *   stopped (`lib/workflows/account-pause`), an automated send is
 *   deferred, never made and never errored. The executor already skips a
 *   stopped MC's steps; this catches the one it had claimed a moment
 *   before the stop went on. The MC's own Run now passes through.
 * - **The opt-out check.** An unsubscribed or bounced address is never
 *   mailed, and a couple's `do_not_email` flag stops mail to the couple
 *   (only to the couple: their vendors never opted out of anything).
 * - **The send-rate brake.** Every send through the shared Zebri domain
 *   counts against the tenant's burst and daily limits, after the opt-out
 *   check, so a suppressed recipient costs no quota.
 * - **The send log.** Every message that reaches the transport writes a
 *   `couple_emails` row (`sent` with the provider id, or `failed`) via
 *   `logAutomatedSend` in `./send-log`, after the send and never failing
 *   it. That row is the Emails-tab record, what the Resend webhook
 *   advances to delivered or bounced, and what the daily cap counts.
 * - **The unsubscribe facility.** A commercial send (anything not on the
 *   transactional allow-list in `./commercial-classification`) carries,
 *   per recipient, a footer link to that recipient's unsubscribe page and
 *   a `List-Unsubscribe` header naming the RFC 8058 one-click route. The
 *   classification is consulted HERE, from the action type the caller
 *   names, so an action cannot skip the floor by where it happens to live.
 *
 * Each of the first three has been shipped missing at least once, in a
 * different action each time, and the last three were missing from five
 * actions at the end of Phase 2. Hence one implementation, and a gate
 * (`scripts/check-no-direct-email-send.mjs`) that fails the build when
 * an action reaches a provider on its own.
 *
 * Two shapes of call. {@link sendAutomationEmail} sends one message to
 * one recipient. {@link openAutomationSend} is for a step that mails
 * several people: it checks every recipient and charges the rate limit
 * for the whole step ONCE, before anything is dispatched, so a limit hit
 * halfway cannot leave the step re-sending (and re-charging) the first
 * half on every wake while the second half never goes.
 *
 * `send_email` is the one automated send that does not come through here:
 * it sends through the MC's own mailbox, with cc and bcc, and runs the
 * same checks inline. It builds its per-recipient links with
 * {@link buildUnsubscribeLinks} and brakes with
 * {@link enforceWorkflowSendLimit}, so the rules are still defined once.
 *
 * @module lib/email/automation-send
 */

import { sendAlert } from '@/lib/alerts';
import { checkWorkflowSendLimit } from '@/lib/api/rate-limit';
import type { PublicBranding } from '@/lib/branding/public-branding';
import { createAdminClient } from '@/lib/supabase/admin';
import { readAccountPause } from '@/lib/workflows/account-pause';
import type { ActionResult, ActionType } from '@/types/automations';

import { isTransactionalSend } from './commercial-classification';
import { AUTOMATED_TAG, dispatchEmail, transportDeduplicates, type EmailAttachment } from './dispatch';
import { appendComplianceFooter } from './html';
import { contentFingerprint, sendIdempotencyKey } from './idempotency';
import { logAutomatedSend, transportOf, type AutomatedSendLogEntry } from './send-log';
import type { ResolvedSender } from './sender-identity';
import { isCoupleOptedOut, isEmailSuppressed } from './suppression';
import { createUnsubscribeToken } from './unsubscribe-token';

/** The shared Zebri address every pre-composed automation email sends from. */
export const AUTOMATION_FROM = 'Zebri <noreply@app.zebri.com.au>';

/** Base URL for public surfaces. Matches the send-context helper. */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.zebri.com.au';

/** The two unsubscribe URLs one recipient's copy of a commercial email carries. */
export interface UnsubscribeLinks {
  /**
   * The human confirmation page, `/unsubscribe/<token>`. Linked from the
   * email footer. A GET that never writes, so a link scanner cannot opt
   * anyone out.
   */
  pageUrl: string;
  /**
   * The RFC 8058 one-click route, `/api/unsubscribe/<token>`. Advertised
   * in `List-Unsubscribe`; a mailbox provider POSTs to it and it records
   * the opt-out. A page cannot accept that POST, which is why this is a
   * separate URL.
   */
  oneClickUrl: string;
}

/**
 * Build one recipient's unsubscribe links.
 *
 * Minted per recipient, from the address that copy is sent TO: the token
 * encodes that address, so a spouse's link unsubscribes the spouse and a
 * vendor's link the vendor, never the couple. Built on every send (never
 * cached) so a token refresh, if expiry is ever added, is transparent.
 *
 * Throws when `UNSUBSCRIBE_TOKEN_SECRET` is unset, like the token module.
 *
 * @param userId The MC (workflow owner): whose list this is.
 * @param coupleId The couple the send is about (shown on the page).
 * @param email The address this copy is sent to.
 */
export function buildUnsubscribeLinks(userId: string, coupleId: string, email: string): UnsubscribeLinks {
  const token = createUnsubscribeToken({ userId, coupleId, email });
  return {
    pageUrl: `${APP_URL}/unsubscribe/${token}`,
    oneClickUrl: `${APP_URL}/api/unsubscribe/${token}`,
  };
}

/**
 * The sender for an automation email that is not on the MC's own
 * mailbox. Named as a {@link ResolvedSender} so it routes through
 * `dispatchEmail` like any other send, and so
 * {@link transportDeduplicates} can answer for it rather than the
 * caller assuming.
 */
const AUTOMATION_SENDER: ResolvedSender = { transport: 'resend', from: AUTOMATION_FROM };

/** The `kind: 'sleep'` arm of an action result. */
export type SleepResult = Extract<ActionResult, { kind: 'sleep' }>;

/**
 * Charge `weight` sends against the tenant's shared-domain limits.
 *
 * Returns null when the sends may proceed, or the `send_rate_limited`
 * sleep the caller should return as its action result: a breach is not a
 * failure (nothing reached the transport), so the step parks and wakes on
 * its own once the window reopens. Raises `workflow_send_rate_limited`
 * at most once per tenant, threshold and window.
 *
 * When the daily count could not be read (fix round 1, I3) the sleep is
 * `send_check_unavailable` instead, and the alert is
 * `workflow_send_cap_unreadable`: nothing hit a limit, the check itself
 * failed, and saying "limit reached" would send the MC and the on-call
 * person looking in the wrong place.
 *
 * Call it only for sends through the shared Zebri domain, and only after
 * the opt-out check, weighted by the recipients that will actually be
 * sent to.
 *
 * @param userId The tenant.
 * @param weight How many individual sends this step is about to make.
 */
export async function enforceWorkflowSendLimit(
  userId: string,
  weight: number,
): Promise<SleepResult | null> {
  if (weight <= 0) return null;
  const limit = await checkWorkflowSendLimit(userId, weight);
  if (limit.allowed) return null;
  if (limit.scope === 'daily_cap_unreadable') {
    if (limit.shouldAlert) {
      void sendAlert({
        type: 'workflow_send_cap_unreadable',
        severity: 'error',
        userId,
        code: limit.errorCode ?? null,
      });
    }
    return {
      kind: 'sleep',
      reason: 'send_check_unavailable',
      wakeAt: new Date(Date.now() + limit.retryAfterMs).toISOString(),
      payload: { attempted: weight },
    };
  }
  if (limit.shouldAlert) {
    void sendAlert({
      type: 'workflow_send_rate_limited',
      severity: 'warn',
      userId,
      scope: limit.scope ?? 'burst',
      attempted: weight,
      retryAfterMs: limit.retryAfterMs,
    });
  }
  return {
    kind: 'sleep',
    reason: 'send_rate_limited',
    wakeAt: new Date(Date.now() + limit.retryAfterMs).toISOString(),
    payload: { scope: limit.scope ?? null, attempted: weight },
  };
}

/**
 * The sleep a send returns while the account-wide stop is on.
 *
 * Due now, so that when the stop lifts this step counts as having come
 * due inside the stop and is skipped rather than sent late. Until then
 * the executor does not pick it up at all. Exported for `send_email`,
 * which makes the same check outside the gate.
 */
export function accountPausedSleep(): SleepResult {
  return { kind: 'sleep', reason: 'account_paused', wakeAt: new Date().toISOString() };
}

/** One person a step is about to mail. */
export interface AutomationRecipient {
  to: string;
  /**
   * Whether this address is the couple's own (their primary or spouse
   * address). `couples.do_not_email` is consulted only when it is: the
   * flag records that the couple asked to stop hearing from the MC, and
   * says nothing about their florist.
   */
  isCouple: boolean;
}

/** What {@link openAutomationSend} needs to check a step's recipients. */
export interface AutomationGateInput {
  /**
   * The action this send belongs to. Decides, through
   * `isTransactionalSend`, whether the send is commercial and so carries
   * the unsubscribe link and header.
   */
  actionType: ActionType;
  /** The tenant (workflow owner). */
  userId: string;
  /** The couple the step is about. Named in every unsubscribe token. */
  coupleId: string;
  /**
   * The workflow instance the step belongs to (`ctx.instanceId`), carried
   * onto each message's `couple_emails` row. Optional only so hand-built
   * inputs in tests need not name one.
   */
  instanceId?: string | null | undefined;
  /** Everyone the step will mail. */
  recipients: readonly AutomationRecipient[];
  /**
   * The transport. Defaults to the shared Zebri address. An action that
   * sends as the MC (their connected mailbox) passes the resolved sender;
   * only shared-domain sends count against the rate limit.
   */
  sender?: ResolvedSender | undefined;
  /**
   * The MC ran this step by hand (`ctx.manualRun`). Only a manual run
   * passes the account-wide stop; everything else is deferred by it.
   */
  manualRun?: boolean | undefined;
}

/** One message to one recipient of an opened gate. */
export interface AutomationMessage {
  /**
   * The workflow step this send belongs to, which is what a retry
   * repeats. Null or undefined means no idempotency key is sent: every
   * reachable path today has one, and a caller that does not should lose
   * the protection visibly rather than silently.
   */
  stepId: string | null | undefined;
  /** Must be one of the recipients the gate was opened with. */
  to: string;
  subject: string;
  /**
   * Render this recipient's body. Receives their unsubscribe page URL for
   * a commercial send, or null for a transactional one. A render that
   * does not put the URL in the body gets the identity and unsubscribe
   * block appended, so the floor holds either way.
   */
  render: (unsubscribeUrl: string | null) => string;
  /** Who is sending, for the appended footer when the render lacks one. */
  identity: { businessName: string; branding?: PublicBranding | null | undefined };
  replyTo?: string | null | undefined;
  attachments?: EmailAttachment[] | undefined;
  /**
   * Everything about this send that changes what the recipient gets, as
   * a JSON-serialisable object with a fixed key order. Taken from the
   * step's configured copy rather than the rendered output: see
   * {@link contentFingerprint}.
   */
  fingerprint: unknown;
}

/** What the caller needs to decide what to report for one recipient. */
export interface AutomationSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  /**
   * On a failure, a short token safe for an alert: the transport's
   * `DispatchResult.code`, or `render_failed` when the message could not
   * be built. Never the message, which can quote the address.
   */
  code?: string;
  /**
   * Whether the executor may retry this send. False when the transport
   * cannot collapse a repeat, where the failures a retry most wants (a
   * thrown request, a timeout) are the ones that may have delivered.
   * Pass it straight through as an `ActionResult`'s `recoverable`.
   */
  recoverable: boolean;
  /**
   * Why the send was deliberately not made: `suppressed` (the address
   * unsubscribed, bounced or complained) or `couple_opted_out` (the
   * couple's own address, with `do_not_email` set). The step should
   * record this distinctly so the MC sees a deliberate skip.
   */
  skipped?: string;
  /**
   * Set when the step was held back before anything was dispatched: the
   * tenant's send-rate limit, or the account-wide stop (`reason` says
   * which). Return it as the action result.
   */
  deferred?: SleepResult;
}

/** An opened gate: every recipient checked, the step's quota charged. */
export interface OpenAutomationGate {
  kind: 'open';
  /** Why `to` will not be mailed, or undefined when it will. */
  skipped(to: string): string | undefined;
  /** Send one recipient's message. Never throws. */
  send(message: AutomationMessage): Promise<AutomationSendResult>;
}

/**
 * The three outcomes of {@link openAutomationSend}: open (send through
 * it), `check_failed` (a lookup failed, so send nothing and let the step
 * retry), or `deferred` (the send-rate limit or the account-wide stop
 * held it; return `sleep` as the action result).
 */
export type AutomationGate =
  | OpenAutomationGate
  | { kind: 'check_failed'; error: string }
  | { kind: 'deferred'; sleep: SleepResult };

/** The key recipients are matched on inside a gate. */
function addressKey(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Check every recipient of a step, charge the step's sends against the
 * rate limit once, and return a gate to send through.
 *
 * Each opt-out check has three outcomes and they stay three:
 *
 * - blocked: that recipient is skipped (`skipped` says why), a deliberate
 *   decision a retry could never change.
 * - clear: that recipient is mailed.
 * - the check could not be completed: `check_failed`, and nothing is
 *   sent to anyone. Sending would mail someone who may have unsubscribed;
 *   recording a skip would permanently drop an email nobody asked to
 *   stop. Deferring is the only answer that is not wrong in one of those
 *   directions, and because no recipient has been mailed yet, deferring
 *   costs nothing even on a transport that cannot deduplicate.
 *
 * The rate limit is charged only for shared-domain sends, only for the
 * recipients that survived the opt-out check, and once per step: a step
 * mailing 25 vendors is one weighted charge, which a fresh window admits
 * even above the burst max (see `inMemoryLimiter`).
 */
export async function openAutomationSend(input: AutomationGateInput): Promise<AutomationGate> {
  const supabase = createAdminClient();
  const sender = input.sender ?? AUTOMATION_SENDER;
  const skips = new Map<string, string>();

  // First, before any per-recipient work: a stopped account sends
  // nothing automated. A failed read is `check_failed`, like the opt-out
  // lookups below: sending on a stop nobody could check is the one
  // answer that is certainly wrong.
  if (!input.manualRun) {
    const stop = await readAccountPause(supabase, input.userId);
    if (stop.status === 'unknown') {
      return { kind: 'check_failed', error: `account stop check failed: ${stop.reason}` };
    }
    if (stop.status === 'paused') return { kind: 'deferred', sleep: accountPausedSleep() };
  }

  let coupleOptedOut: boolean | null = null;
  for (const r of input.recipients) {
    const key = addressKey(r.to);
    if (skips.has(key)) continue;

    const address = await isEmailSuppressed(supabase, input.userId, r.to);
    if (address.status === 'unknown') {
      return { kind: 'check_failed', error: `suppression check failed: ${address.reason}` };
    }
    if (address.status === 'blocked') {
      skips.set(key, 'suppressed');
      continue;
    }

    if (r.isCouple) {
      // One flag on one row, so it is read once however many of the
      // couple's own addresses the step names.
      if (coupleOptedOut === null) {
        const couple = await isCoupleOptedOut(supabase, input.userId, input.coupleId);
        if (couple.status === 'unknown') {
          return { kind: 'check_failed', error: `couple opt-out check failed: ${couple.reason}` };
        }
        coupleOptedOut = couple.status === 'blocked';
      }
      if (coupleOptedOut) skips.set(key, 'couple_opted_out');
    }
  }

  const known = new Set(input.recipients.map((r) => addressKey(r.to)));
  const clearCount = [...known].filter((key) => !skips.has(key)).length;

  if (sender.transport === 'resend') {
    const sleep = await enforceWorkflowSendLimit(input.userId, clearCount);
    if (sleep) return { kind: 'deferred', sleep };
  }

  const commercial = !isTransactionalSend(input.actionType);
  const recoverable = transportDeduplicates(sender);

  return {
    kind: 'open',
    skipped: (to) => skips.get(addressKey(to)),
    async send(message) {
      const key = addressKey(message.to);
      if (!known.has(key)) {
        // A programming error, not a runtime condition: the address was
        // never checked, so it must not be mailed.
        return {
          ok: false,
          error: `${message.to} was not checked by this gate`,
          code: 'not_checked',
          recoverable: false,
        };
      }
      const skipped = skips.get(key);
      if (skipped) return { ok: true, recoverable: false, skipped };

      let html: string;
      let listUnsubscribeUrl: string | undefined;
      try {
        if (commercial) {
          const links = buildUnsubscribeLinks(input.userId, input.coupleId, message.to);
          html = message.render(links.pageUrl);
          // The floor, whatever the renderer did: a commercial body that
          // does not carry this recipient's link gets the identity and
          // unsubscribe block appended.
          if (!html.includes(links.pageUrl)) {
            html = appendComplianceFooter(
              html,
              message.identity.businessName,
              message.identity.branding,
              links.pageUrl,
            );
          }
          listUnsubscribeUrl = links.oneClickUrl;
        } else {
          html = message.render(null);
        }
      } catch (err) {
        // Minting a token throws when UNSUBSCRIBE_TOKEN_SECRET is unset.
        // Nothing was sent, so a retry once the deploy is fixed is safe.
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          code: 'render_failed',
          recoverable: true,
        };
      }

      const fingerprint = contentFingerprint(message.fingerprint);
      // The provider's idempotency key, and the identity of this
      // message's couple_emails row across retries.
      const attemptKey = message.stepId ? sendIdempotencyKey(message.stepId, message.to, fingerprint) : null;
      const res = await dispatchEmail(sender, {
        to: message.to,
        subject: message.subject,
        html,
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
        ...(message.attachments?.length ? { attachments: message.attachments } : {}),
        ...(attemptKey ? { idempotencyKey: attemptKey } : {}),
        ...(listUnsubscribeUrl ? { listUnsubscribeUrl } : {}),
        // Tag with the tenant so a Resend bounce or complaint can be
        // attributed to the right owner, and `src=auto` because this
        // message writes a couple_emails row the webhook should find
        // (M3). Resend only: the OAuth transports raise no webhook events.
        ...(sender.transport === 'resend'
          ? { tags: [{ name: 'tenant', value: input.userId }, AUTOMATED_TAG] }
          : {}),
      });

      // Logged here, where this one recipient's transport answer is
      // known, and only after it: the log can never stop or repeat a
      // send, and a render failure above (nothing dispatched) writes no
      // row because nothing was attempted against the domain.
      const log = (result: AutomatedSendLogEntry['result']) =>
        logAutomatedSend(supabase, {
          userId: input.userId,
          coupleId: input.coupleId,
          stepId: message.stepId,
          instanceId: input.instanceId,
          to: message.to,
          subject: message.subject,
          transport: transportOf(sender),
          attemptKey,
          result,
        });

      // `ok` is the success signal, not the message id (same rule as
      // 98bb9018 on main): Microsoft Graph's sendMail answers 202 with an
      // empty body, so an Outlook-connected MC's delivered email has no
      // id. It is logged as `sent` with no provider id; only the webhook,
      // which Graph never calls, needed one.
      if (!res.ok) {
        const error = res.error ?? 'send failed';
        await log({ ok: false, error });
        return { ok: false, error, code: res.code ?? 'unknown', recoverable };
      }
      await log({ ok: true, ...(res.messageId ? { messageId: res.messageId } : {}) });
      return { ok: true, ...(res.messageId ? { messageId: res.messageId } : {}), recoverable };
    },
  };
}

/** One automation email to one recipient. */
export interface AutomationSendInput extends Omit<AutomationMessage, 'to'> {
  /** See {@link AutomationGateInput.actionType}. */
  actionType: ActionType;
  /** The tenant (workflow owner). */
  userId: string;
  /** The couple this send is about. */
  coupleId: string;
  /** See {@link AutomationGateInput.instanceId}. */
  instanceId?: string | null | undefined;
  to: string;
  /** See {@link AutomationRecipient.isCouple}. */
  recipientIsCouple: boolean;
  /** See {@link AutomationGateInput.sender}. */
  sender?: ResolvedSender | undefined;
  /** See {@link AutomationGateInput.manualRun}. */
  manualRun?: boolean | undefined;
}

/**
 * Send one automation email to one recipient, through the full gate.
 *
 * Outcomes, all without throwing:
 *
 * - opted out: `{ ok: true, skipped }`, never retried.
 * - an opt-out lookup failed: `{ ok: false, recoverable: true }`, so the
 *   executor defers the step onto its backoff.
 * - rate-limited, or the account-wide stop is on: `{ ok: false,
 *   deferred }`; return `deferred` as the action result.
 * - sent, or a transport error: the {@link dispatchEmail} result, with
 *   `recoverable` from {@link transportDeduplicates}.
 */
export async function sendAutomationEmail(input: AutomationSendInput): Promise<AutomationSendResult> {
  const gate = await openAutomationSend({
    actionType: input.actionType,
    userId: input.userId,
    coupleId: input.coupleId,
    instanceId: input.instanceId,
    recipients: [{ to: input.to, isCouple: input.recipientIsCouple }],
    sender: input.sender,
    manualRun: input.manualRun,
  });
  if (gate.kind === 'check_failed') return { ok: false, error: gate.error, recoverable: true };
  if (gate.kind === 'deferred') {
    const error =
      gate.sleep.reason === 'account_paused'
        ? 'workflow automation is paused for this account'
        : gate.sleep.reason === 'send_check_unavailable'
          ? 'the daily send check is unavailable'
          : 'send rate limit reached';
    return { ok: false, error, recoverable: true, deferred: gate.sleep };
  }
  return gate.send({
    stepId: input.stepId,
    to: input.to,
    subject: input.subject,
    render: input.render,
    identity: input.identity,
    replyTo: input.replyTo,
    attachments: input.attachments,
    fingerprint: input.fingerprint,
  });
}
