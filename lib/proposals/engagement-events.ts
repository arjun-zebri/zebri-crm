/**
 * Vocabulary and validation for public-proposal engagement events.
 *
 * The public proposal page (Task 4) batches these client-side and posts
 * them to `POST /api/proposal/[token]/events` (Task 3), which validates
 * with `eventsBodySchema` before writing `proposal_events` rows. Keep this
 * module import-safe from a route handler's module graph (no `'use server'`,
 * no React) since the route, its tests, and the aggregation layer
 * (`./engagement.ts`) all import from here.
 *
 * {@link EngagementEvent} is what a component hands the in-page bus (no
 * id -- the emit call sites do not need to think about idempotency).
 * {@link QueuedEngagementEvent} is the wire shape: an `EngagementEvent`
 * plus a client-generated `id`, stamped once when the tracker queues the
 * event, not when it flushes (see `newEventId` in `engagement-session.ts`).
 * A retry of a batch the client believes failed to land carries the same
 * ids, and `record_proposal_events` uses them to make a replay a no-op.
 *
 * @module lib/proposals/engagement-events
 */
import { z } from 'zod'

/** Every event type the public proposal page can emit. */
export const ENGAGEMENT_EVENT_TYPES = [
  'opened',
  'section_viewed',
  'package_viewed',
  'package_selected',
  'addon_toggled',
  'step_reached',
  'accepted',
  'declined',
] as const

/** One of {@link ENGAGEMENT_EVENT_TYPES}. */
export type EngagementEventType = (typeof ENGAGEMENT_EVENT_TYPES)[number]

/** Steps of the accept stepper, in the order a couple moves through them. */
export const ACCEPT_STEPS = ['choose', 'sign', 'pay', 'done'] as const

/**
 * A single engagement event as emitted by the public proposal page (over
 * `engagement-bus.ts`, or the tracker's own `opened`/view events).
 *
 * Discriminated on `type`; each variant's `payload` carries only what that
 * event needs. `opened` and `accepted` carry no data of their own (the
 * session id and timestamp identify them), so their payload type is
 * `Record<string, never>`. See the module doc above for the `id` that is
 * added when this is queued for delivery.
 */
export type EngagementEvent =
  | { type: 'opened'; payload: Record<string, never> }
  | { type: 'section_viewed'; payload: { blockId: string; blockType: string; seconds: number } }
  | { type: 'package_viewed'; payload: { optionId: string; seconds: number } }
  | { type: 'package_selected'; payload: { optionId: string } }
  | { type: 'addon_toggled'; payload: { itemId: string; on: boolean } }
  | { type: 'step_reached'; payload: { step: (typeof ACCEPT_STEPS)[number] } }
  | { type: 'accepted'; payload: Record<string, never> }
  | { type: 'declined'; payload: { reason: string } }

/**
 * An {@link EngagementEvent} plus its client-generated idempotency key.
 * This, not `EngagementEvent`, is what actually rides in a batch and what
 * `record_proposal_events` dedupes on -- `id` is not the row's own
 * primary key, it is a value the client controls.
 */
export type QueuedEngagementEvent = EngagementEvent & { id: string }

// Bounds shared by every id-like field and every duration field below: an
// anonymous browser is the source, so these guard against a malformed or
// hostile batch rather than any real proposal shape. The same bound is
// reused for the event's own `id`: `crypto.randomUUID()` fits it easily,
// and so does the shorter fallback `newEventId` uses when `crypto` is
// unavailable.
const id = z.string().min(1).max(64)
const seconds = z.number().min(0).max(3600)
const emptyPayload = z.object({}).strict()

/**
 * Runtime schema for one wire event, i.e. {@link QueuedEngagementEvent}.
 * Mirrors the type exactly, `id` included, since every event actually
 * validated by the route (or the RPC) already has one.
 */
export const engagementEventSchema: z.ZodType<QueuedEngagementEvent> = z.discriminatedUnion('type', [
  z.object({ id, type: z.literal('opened'), payload: emptyPayload }),
  z.object({
    id,
    type: z.literal('section_viewed'),
    payload: z.object({ blockId: id, blockType: id, seconds }).strict(),
  }),
  z.object({
    id,
    type: z.literal('package_viewed'),
    payload: z.object({ optionId: id, seconds }).strict(),
  }),
  z.object({
    id,
    type: z.literal('package_selected'),
    payload: z.object({ optionId: id }).strict(),
  }),
  z.object({
    id,
    type: z.literal('addon_toggled'),
    payload: z.object({ itemId: id, on: z.boolean() }).strict(),
  }),
  z.object({
    id,
    type: z.literal('step_reached'),
    payload: z.object({ step: z.enum(ACCEPT_STEPS) }).strict(),
  }),
  z.object({ id, type: z.literal('accepted'), payload: emptyPayload }),
  z.object({
    id,
    type: z.literal('declined'),
    payload: z.object({ reason: id }).strict(),
  }),
])

/**
 * Body of `POST /api/proposal/[token]/events`: a batch of up to 50 events
 * from one browser session. Capped at 50 because the public page flushes
 * often; a larger batch is a malformed or hostile request.
 */
export const eventsBodySchema = z.object({
  token: z.uuid(),
  sessionId: z.string().min(8).max(64),
  events: z.array(engagementEventSchema).min(1).max(50),
})

/** Validated body of the events route. */
export type EventsBody = z.infer<typeof eventsBodySchema>
