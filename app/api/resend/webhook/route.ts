/**
 * Resend webhook handler for bounce, complaint, and delivery events.
 *
 * - Verifies the Svix signature at the boundary, over the raw body,
 *   before anything in the body is parsed or trusted.
 * - Reads the owner from the `tenant` tag the send path set on the
 *   message (see `DispatchPayload.tags`).
 * - Writes an `email_suppression` row for permanent bounces and for
 *   complaints (a transient or untyped bounce alerts and writes nothing), and
 *   fires `resend_bounced` only when a row was actually inserted, so a
 *   replayed event is a no-op.
 * - Advances the message's `couple_emails` row by provider message id
 *   (Task 30): delivered, bounced, complained or deferred, never
 *   backwards, and idempotent on a replay. See {@link advanceDeliveryStatus}.
 *   Suppression never waits on it: a failed delivery write is alerted
 *   and only turns into a 500 (a Resend retry) after suppression has run.
 *   An automated message (`src=auto`) whose row is not written yet is also
 *   a 500 while the event is under ten minutes old, so it is not lost.
 * - Leaves every event on an MC's own paper-trail copy (`mc_copy`) alone:
 *   no row moves and nobody is suppressed.
 * - Returns 200 for every other event type, so the provider never
 *   retries, and eventually disables, the endpoint over an event we do
 *   not consume.
 *
 * Verification is implemented here rather than through the `svix`
 * package: `svix` is only a transitive dependency (via `resend`), not one
 * this app declares, and the scheme is small. The integration test signs
 * with the real `svix` library, so any drift between the two shows up as
 * a failing happy path.
 *
 * @module app/api/resend/webhook/route
 */

import crypto from 'crypto'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { sendAlert } from '@/lib/alerts'
import { logger } from '@/lib/alerts/logger'
import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit'
import { AUTOMATED_TAG, COPIES_TAG_NAME, MC_COPY_TAG_NAME } from '@/lib/email/dispatch'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * The tag name the send path uses to carry the owner's user id. Must
 * match the `tags` set in `lib/automations/actions/messaging.ts`,
 * `lib/email/automation-send.ts` and `lib/email/index.ts`.
 */
const TENANT_TAG_NAME = 'tenant'

/**
 * How far a `svix-timestamp` may sit from our clock, in seconds, before
 * the request is refused. Five minutes is the tolerance Svix's own
 * library applies. It bounds how long a captured request can be replayed.
 */
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60

/**
 * Per-IP limit on this public endpoint. Resend delivers from a small pool
 * of addresses, so one IP legitimately carries a whole campaign's bounce
 * burst; 1000 a minute leaves room for hundreds of bounces in a minute
 * while still cutting off a scanner hammering the route. The signature
 * check is the real gate; this only caps the cost of failed attempts.
 */
const limiter = inMemoryLimiter({ windowMs: 60 * 1000, max: 1000 })

/**
 * Tags as they arrive on a webhook. The Resend SDK types them as a
 * `Record<string, string>` (`BaseEmailEventData.tags` in resend 6.12),
 * which is not the `{ name, value }[]` shape the send API takes. The
 * array form is accepted too, so a change of shape on Resend's side
 * degrades to "still attributed" rather than "every event untagged".
 */
const tagsSchema = z.union([
  z.record(z.string(), z.string()),
  z.array(z.object({ name: z.string(), value: z.string() })),
])

/**
 * The part of a Resend email event this handler reads. Mirrors the SDK's
 * `EmailBouncedEvent` / `EmailComplainedEvent` shape: `{ type,
 * created_at, data: { to, subject, tags, ... } }`. Everything else in
 * `data` is ignored. Parsed only after the signature has been verified.
 */
const resendEventSchema = z.object({
  type: z.string(),
  /** When Resend recorded the event. Used as the row's delivered/bounced time. */
  created_at: z.string().optional(),
  data: z
    .object({
      /** Resend's message id: the `provider_message_id` the send path logged. */
      email_id: z.string().optional(),
      to: z.array(z.string()).optional(),
      subject: z.string().optional(),
      tags: tagsSchema.optional(),
      /** Present on `email.bounced`: `Permanent`, `Transient` or `Undetermined`. */
      bounce: z.object({ type: z.string().optional() }).passthrough().optional(),
    })
    .passthrough()
    .optional(),
})

type ResendEvent = z.infer<typeof resendEventSchema>

/** The value of tag `name` on the event, or null when it is absent. */
function tagValue(tags: z.infer<typeof tagsSchema> | undefined, name: string): string | null {
  if (!tags) return null
  if (Array.isArray(tags)) {
    return tags.find((t) => t.name === name)?.value ?? null
  }
  return tags[name] ?? null
}

/**
 * Owner user id from the event's tags, or null when the send was untagged
 * or the tag is not a uuid. Checked here rather than left to Postgres, so
 * a malformed tag takes the same "cannot attribute" path as a missing one
 * instead of surfacing as a 22P02 write failure.
 */
function extractTenant(tags: z.infer<typeof tagsSchema> | undefined): string | null {
  const value = tagValue(tags, TENANT_TAG_NAME)
  return value !== null && z.string().uuid().safeParse(value).success ? value : null
}

/** Why a request failed verification. Logged, never returned to the caller. */
type SvixVerifyFailure = 'missing_headers' | 'bad_timestamp' | 'stale_timestamp' | 'no_match'

/**
 * Verify a Svix-signed request.
 *
 * Svix signs `${svix-id}.${svix-timestamp}.${rawBody}` with HMAC-SHA256,
 * keyed by the base64 bytes of the secret after its `whsec_` prefix, and
 * sends the result in `svix-signature` as space-separated
 * `v1,<base64 signature>` entries. There can be several entries while a
 * secret is being rotated, so any one matching is enough.
 *
 * Not exported: a Next.js route module may only export route handlers
 * and segment config.
 *
 * @param rawBody - The request body exactly as received.
 * @param headers - The `svix-id`, `svix-timestamp` and `svix-signature` values.
 * @param secret - `RESEND_WEBHOOK_SECRET`, with or without the `whsec_` prefix.
 * @returns `null` when the request is authentic, else why it is not.
 */
function verifySvixSignature(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
): SvixVerifyFailure | null {
  const { id, timestamp, signature } = headers
  if (!id || !timestamp || !signature) return 'missing_headers'

  // Integer seconds only. `Number('')` is 0 and `Number('1e3')` is
  // 1000, so the shape is checked before the value.
  if (!/^\d+$/.test(timestamp)) return 'bad_timestamp'
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSeconds - Number(timestamp)) > TIMESTAMP_TOLERANCE_SECONDS) {
    return 'stale_timestamp'
  }

  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64')
  const expected = crypto
    .createHmac('sha256', key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest()

  for (const entry of signature.split(' ')) {
    const [version, value] = entry.split(',', 2)
    if (version !== 'v1' || !value) continue
    const provided = Buffer.from(value, 'base64')
    // `timingSafeEqual` throws on unequal lengths, so the guard comes
    // first. Length is not secret: every valid signature is 32 bytes.
    if (provided.length === expected.length && crypto.timingSafeEqual(provided, expected)) {
      return null
    }
  }
  return 'no_match'
}

/**
 * Receive a Resend webhook event.
 *
 * 429 when rate-limited, 500 when `RESEND_WEBHOOK_SECRET` is unset (never
 * a silent skip of verification) or a delivery-status write failed
 * transiently (after suppression has run, so Resend retries only the
 * record) or an automated message's row is not written yet (while the
 * event is young), 400 on any signature failure, and 200 for everything
 * else verified, including event types this handler ignores, events on
 * an MC's own copy, and a schema-shaped delivery-write failure (alerted
 * instead).
 */
export async function POST(request: NextRequest) {
  const ip = ipOf(request)
  const { allowed } = await limiter.check(ip)
  if (!allowed) {
    logger.warn('[resend/webhook] rate limited', { ip })
    return NextResponse.json({ error: 'rate limited' }, { status: 429 })
  }

  // An unset secret is a deploy mistake, not a reason to accept
  // unverified writes: an unauthenticated POST here could otherwise
  // suppress a tenant's entire contact list.
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    logger.error('[resend/webhook] RESEND_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'webhook secret not configured' }, { status: 500 })
  }

  // Raw text, not `request.json()`: the signature covers the exact bytes
  // Resend sent, and a parse and re-serialise would change them.
  const rawBody = await request.text()
  const failure = verifySvixSignature(
    rawBody,
    {
      id: request.headers.get('svix-id'),
      timestamp: request.headers.get('svix-timestamp'),
      signature: request.headers.get('svix-signature'),
    },
    secret,
  )
  if (failure) {
    logger.warn('[resend/webhook] signature verification failed', { ip, failure })
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  let json: unknown
  try {
    json = JSON.parse(rawBody)
  } catch {
    logger.error('[resend/webhook] verified body is not JSON')
    return NextResponse.json({ received: true })
  }

  // A verified body that fails the schema is Resend's shape changing, not
  // an attack. 200 so it is not retried forever; the log makes it visible.
  // (`@/lib/api/validate` parses from the request, whose body has already
  // been consumed as text for the signature, so Zod is applied directly.)
  const parsed = resendEventSchema.safeParse(json)
  if (!parsed.success) {
    logger.error('[resend/webhook] event failed validation', { issues: parsed.error.issues })
    return NextResponse.json({ received: true })
  }
  const event = parsed.data

  // The delivery record (Task 30), for every event type that has one.
  // Its outcome is held until suppression below has run: the display log
  // must never stand between a permanent bounce or a complaint and its
  // suppression row, which is the legal and deliverability floor (fix
  // round 1, I1).
  // The MC's own paper-trail copy of a send_email step (Phase 5 fix wave,
  // I1): its own message, never a couple_emails row and never a
  // subscriber. Nothing it reports is about the couple, so it moves no
  // row and suppresses nobody; a full MC inbox is theirs to notice.
  if (tagValue(event.data?.tags, MC_COPY_TAG_NAME) !== null) {
    logger.info('[resend/webhook] event on an MC copy acknowledged', { type: event.type })
    return NextResponse.json({ received: true })
  }

  const delivery = DELIVERY_EVENTS[event.type]
  const deliveryWrite: DeliveryWriteOutcome = delivery ? await advanceDeliveryStatus(event, delivery) : 'ok'

  switch (event.type) {
    case 'email.bounced': {
      // Only a permanent bounce means the address is dead. A transient
      // one (a full mailbox, a greylisting server) or an undetermined one
      // can clear tomorrow, and a suppression row is permanent: writing
      // one here would silence a couple whose inbox works. So anything
      // but `Permanent`, including a missing type, alerts for a person to
      // look at and writes nothing.
      const bounceType = event.data?.bounce?.type ?? null
      if (bounceType !== 'Permanent') {
        logger.warn('[resend/webhook] non-permanent bounce, not suppressing', { bounceType })
        await sendAlert({
          type: 'app_error',
          severity: 'error',
          source: 'resend_webhook',
          message: `Resend bounce of type ${bounceType ?? 'unknown'} was not suppressed; only permanent bounces are`,
        })
        break
      }
      await suppress(event, 'bounced')
      break
    }
    case 'email.complained':
      await suppress(event, 'complained')
      break
    case 'email.delivered':
    case 'email.delivery_delayed':
      // Recorded above; nothing to suppress.
      break
    default:
      logger.info('[resend/webhook] unhandled event type acked', { type: event.type })
  }

  // Only now, with suppression done, ask for a retry of a transient
  // delivery-write failure. Both halves are idempotent (the status only
  // moves forward; the suppression insert collapses on its unique index
  // and `resend_bounced` fires only on an insert), so the retry can only
  // finish the delivery record. A schema-shaped failure is answered 200:
  // it will fail identically on every retry, and a Svix endpoint that
  // keeps failing is disabled, which would end suppression for good.
  if (deliveryWrite === 'transient') {
    return NextResponse.json({ error: 'could not record delivery status' }, { status: 500 })
  }
  // An automated message whose row is not written yet (M3): ask again.
  if (deliveryWrite === 'row_missing') {
    return NextResponse.json({ error: 'no delivery record yet' }, { status: 500 })
  }
  return NextResponse.json({ received: true })
}

/** A `couple_emails.status` a webhook event can move a row to. */
type DeliveryStatus = 'deferred' | 'delivered' | 'bounced' | 'complained'

/** The timestamp column each status stamps, where it has one. */
const DELIVERY_TIMESTAMP: Record<DeliveryStatus, 'delivered_at' | 'bounced_at' | 'complained_at' | null> = {
  deferred: null,
  delivered: 'delivered_at',
  bounced: 'bounced_at',
  complained: 'complained_at',
}

/** Resend event types that carry a delivery outcome, and the status each means. */
const DELIVERY_EVENTS: Partial<Record<string, DeliveryStatus>> = {
  'email.delivery_delayed': 'deferred',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
}

/**
 * The statuses each status may replace: only ones that rank below it.
 *
 * sent < deferred < delivered < bounced < complained. A bounce can
 * arrive after a delivery (the receiving server accepted, then rejected)
 * and is the truer answer, so it wins; a delivery that arrives after a
 * bounce (events are not ordered) must not paper over it. A complaint
 * outranks everything: the recipient saw it and marked it spam. `failed`
 * never appears here because a failed send has no provider id to match.
 */
const REPLACEABLE: Record<DeliveryStatus, readonly string[]> = {
  deferred: ['sent'],
  delivered: ['sent', 'deferred'],
  bounced: ['sent', 'deferred', 'delivered'],
  complained: ['sent', 'deferred', 'delivered', 'bounced'],
}

/**
 * How the delivery-status write went, for the response code. `row_missing`
 * is an automated message (tagged `src=auto`) with no row yet, while the
 * event is inside {@link ROW_WAIT_MS}.
 */
type DeliveryWriteOutcome = 'ok' | 'transient' | 'schema' | 'row_missing'

/**
 * How long an automated message's event may wait for its row (M3). The
 * send logs its row right after the transport answers, so a delivery
 * event normally finds it; one that arrives first, or whose row failed to
 * write (already alerted as `automated_send_log_failed`), used to be
 * answered 200 and lost for good. Inside this window the webhook answers
 * 500 so Resend retries; past it, 200, so a row that will never exist
 * cannot walk the endpoint towards being disabled.
 */
const ROW_WAIT_MS = 10 * 60 * 1000

/**
 * Error codes that mean the write can never succeed as the code stands:
 * the column or table is missing (the app deployed ahead of its
 * migration: Vercel and `supabase db push` are separate steps), or the
 * role lacks the grant. Retrying these only walks the endpoint towards
 * being disabled. 42703 undefined column, 42P01 undefined table, 42501
 * insufficient privilege, and PostgREST's schema-cache misses PGRST204
 * (column) and PGRST205 (table).
 */
const SCHEMA_ERROR_CODES: ReadonlySet<string> = new Set(['42703', '42P01', '42501', 'PGRST204', 'PGRST205'])

/**
 * One delivery-write alert per ten minutes for the whole route. The
 * failure is almost always systemic (every event hits the same missing
 * column or the same database outage), so a per-event alert would flood
 * the channel with one line per delivered email.
 */
const deliveryAlertDedup = inMemoryLimiter({ windowMs: 10 * 60 * 1000, max: 1 })

/** Log and alert (deduped) a failed delivery write; classify it. */
async function deliveryWriteFailed(
  step: 'status' | 'timestamp',
  error: { code?: string | null; message: string },
): Promise<DeliveryWriteOutcome> {
  const outcome: DeliveryWriteOutcome = error.code && SCHEMA_ERROR_CODES.has(error.code) ? 'schema' : 'transient'
  logger.error('[resend/webhook] failed to record delivery status', {
    step,
    code: error.code ?? null,
    outcome,
    error: error.message,
  })
  if ((await deliveryAlertDedup.check('delivery')).allowed) {
    await sendAlert({
      type: 'app_error',
      severity: 'error',
      source: 'resend_webhook_delivery',
      message: `could not record a delivery status on couple_emails (${step}, code ${error.code ?? 'unknown'}); ${
        outcome === 'schema' ? 'acknowledged without retry' : 'asked Resend to retry'
      }. Suppression was unaffected.`,
    })
  }
  return outcome
}

/**
 * Move the `couple_emails` row for this event's message forward.
 *
 * Two conditional updates, each atomic on its own, and together
 * monotone and idempotent:
 *
 * 1. The status, only where the current one ranks below the new one
 *    ({@link REPLACEABLE}). A replay, or an older event arriving late,
 *    matches nothing.
 * 2. The event's own timestamp column, only where it is still null, so
 *    a replay keeps the first time. Written even when the status did not
 *    move: a delivered event after a bounce still records that the
 *    message was, at one point, delivered.
 *
 * Matched on `provider_message_id` alone. The id is Resend's, unique
 * across every tenant (a unique index enforces it), and the request is
 * already signature-verified, so no tenant tag is needed to scope it. An
 * event with no matching row (a manual send, a send from before Task 30,
 * a test email) updates nothing and is fine, except an automated one
 * (`src=auto`) younger than {@link ROW_WAIT_MS}, whose row may simply not
 * be written yet: that answers `row_missing`, a 500, so Resend retries.
 *
 * Matched within `transport = 'resend'`: provider ids are unique per
 * transport, and only Resend raises these events.
 *
 * Never throws. A failed write is logged, alerted (deduped) and
 * classified, and the caller decides the response only after
 * suppression has run.
 */
async function advanceDeliveryStatus(event: ResendEvent, status: DeliveryStatus): Promise<DeliveryWriteOutcome> {
  const emailId = event.data?.email_id
  if (!emailId) {
    logger.warn('[resend/webhook] delivery event has no email_id', { type: event.type })
    return 'ok'
  }
  // Only a message the send path logs by id can be "not written yet".
  // Manual sends, the MC's copies and anything from before the tag was
  // added match no row by design.
  const automated = tagValue(event.data?.tags, AUTOMATED_TAG.name) === AUTOMATED_TAG.value
  try {
    return await writeDeliveryStatus(emailId, status, event.created_at, automated)
  } catch (err) {
    return deliveryWriteFailed('status', { message: err instanceof Error ? err.message : String(err) })
  }
}

/** The two conditional updates behind {@link advanceDeliveryStatus}. */
async function writeDeliveryStatus(
  emailId: string,
  status: DeliveryStatus,
  createdAt: string | undefined,
  automated: boolean,
): Promise<DeliveryWriteOutcome> {
  const eventTime = createdAt && !Number.isNaN(Date.parse(createdAt)) ? Date.parse(createdAt) : null
  const at = new Date(eventTime ?? Date.now()).toISOString()

  const admin = createAdminClient()
  const { data: moved, error: statusErr } = await admin
    .from('couple_emails')
    .update({ status })
    .eq('transport', 'resend')
    .eq('provider_message_id', emailId)
    .in('status', [...REPLACEABLE[status]])
    .select('id')
  if (statusErr) return deliveryWriteFailed('status', statusErr)

  // Nothing moved: either the row is already at or past this status (a
  // replay, an older event arriving late), or there is no row. Only the
  // second, for a young automated event, is worth a retry. An event with
  // no time of its own cannot be aged, so it is never held.
  if (!moved?.length && automated && eventTime !== null && Date.now() - eventTime < ROW_WAIT_MS) {
    const { data: row, error: readErr } = await admin
      .from('couple_emails')
      .select('id')
      .eq('transport', 'resend')
      .eq('provider_message_id', emailId)
      .limit(1)
    if (readErr) return deliveryWriteFailed('status', readErr)
    if (!row?.length) {
      logger.info('[resend/webhook] automated event arrived before its row, asking for a retry', {
        type: status,
      })
      return 'row_missing'
    }
  }

  const column = DELIVERY_TIMESTAMP[status]
  if (column) {
    const { error: stampErr } = await admin
      .from('couple_emails')
      .update({ [column]: at })
      .eq('transport', 'resend')
      .eq('provider_message_id', emailId)
      .is(column, null)
    if (stampErr) return deliveryWriteFailed('timestamp', stampErr)
  }
  return 'ok'
}

/**
 * Record a bounce or complaint as a suppression for the tagged owner.
 *
 * Never guesses the owner: an untagged event is logged and alerted, and
 * writes nothing. Idempotent through the `(user_id, lower(email),
 * reason)` unique index; the alert fires only when a row was inserted.
 */
async function suppress(event: ResendEvent, reason: 'bounced' | 'complained'): Promise<void> {
  const recipients = event.data?.to ?? []
  const tenant = extractTenant(event.data?.tags)

  if (!tenant) {
    logger.warn('[resend/webhook] event has no valid tenant tag', { reason })
    await sendAlert({
      type: 'app_error',
      severity: 'error',
      source: 'resend_webhook',
      message: `Resend ${reason} event has no valid tenant tag, so it cannot be attributed to an owner`,
    })
    return
  }

  // The message also went to cc or bcc copies (see COPIES_TAG_NAME in
  // lib/email/dispatch.ts). The event lists only `to`, so the dead
  // mailbox may be a copy's, not the couple's. Suppressing the couple on
  // that guess would silently stop a real client's workflow mail, so this
  // fails safe: no row, and an alert so the MC's mailbox can be checked.
  if (tagValue(event.data?.tags, COPIES_TAG_NAME) !== null) {
    logger.warn('[resend/webhook] event on a message with copies, not suppressing', {
      reason,
      tenant,
    })
    await sendAlert({
      type: 'app_error',
      severity: 'error',
      source: 'resend_webhook',
      message: `Resend ${reason} event for tenant ${tenant} is ambiguous: the message had cc or bcc copies and the event does not say which address failed, so nothing was suppressed`,
    })
    return
  }

  // Every tagged send addresses one recipient per message. With more
  // than one, the event does not say which address bounced, and
  // suppressing all of them would silence addresses that work.
  const email = recipients.length === 1 ? recipients[0] : undefined
  if (!email) {
    logger.warn('[resend/webhook] event does not name exactly one recipient', {
      reason,
      tenant,
      count: recipients.length,
    })
    await sendAlert({
      type: 'app_error',
      severity: 'error',
      source: 'resend_webhook',
      message: `Resend ${reason} event names ${recipients.length} recipients, not suppressing`,
    })
    return
  }

  // Service role: the webhook has no user session. A plain insert, not a
  // PostgREST upsert, because the unique index is on `lower(email)` and
  // `on_conflict` cannot name an expression index. A replay therefore
  // comes back as 23505, which is the "already recorded" signal.
  const { data, error } = await createAdminClient()
    .from('email_suppression')
    .insert({ user_id: tenant, email, reason })
    .select('id')

  if (error) {
    if (error.code === '23505') return
    logger.error('[resend/webhook] failed to write suppression', {
      tenant,
      reason,
      error: error.message,
    })
    await sendAlert({
      type: 'app_error',
      severity: 'error',
      source: 'resend_webhook',
      message: `failed to record ${reason} suppression: ${error.message}`,
    })
    return
  }

  if (data?.length) {
    // No `to` and no `subject` (T27, fix round 1): the suppressed address
    // and the rendered subject line are both couple, contact or vendor
    // PII, never Zebri's own customer's. `userId` (the tenant) is enough
    // to find the row in `email_suppression` from the app.
    await sendAlert({ type: 'resend_bounced', severity: 'warn', userId: tenant, reason })
  }
}
