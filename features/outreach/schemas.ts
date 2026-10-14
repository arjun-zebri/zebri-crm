/**
 * Zod schemas for every Outreach server action input.
 *
 * Kept out of the `'use server'` actions file on purpose: a server
 * action module may only export async functions, and exporting a schema
 * from one compiles fine but crashes at runtime.
 *
 * @module features/outreach/schemas
 */
import { z } from 'zod';

import { SHEET_FIELDS } from '@/lib/outreach/import/sheet';
import { LOST_REASONS, STAGES } from '@/lib/outreach/types';

const id = z.uuid();
const verdict = z.enum(['unchecked', 'active', 'inactive', 'needs_review']);

/** Raw CSV text, capped at 10MB. */
export const csvSchema = z.string().min(1, 'The file is empty.').max(10_000_000, 'That file is over 10MB.');

/** Field → column mapping from the import wizard. */
export const mappingSchema = z.object(
  Object.fromEntries(SHEET_FIELDS.map((f) => [f, z.number().int().min(0).nullable()])) as Record<(typeof SHEET_FIELDS)[number], z.ZodNullable<z.ZodNumber>>,
);

/** Import request. */
export const importSchema = z.object({ csv: csvSchema, mapping: mappingSchema });

/** Prospect table filters. */
export const prospectFiltersSchema = z.object({
  search: z.string().max(100).optional(),
  verdict: verdict.optional(),
  stage: z.enum(STAGES).optional(),
  state: z.string().max(3).optional(),
  minScore: z.number().int().min(0).max(100).optional(),
  hasEmail: z.boolean().optional(),
  hasInstagram: z.boolean().optional(),
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(10).max(200).default(50),
});

/** Scope of a new check run. */
export const runScopeSchema = z.union([
  z.object({ prospectIds: z.array(id).min(1).max(20_000) }),
  z.object({ verdicts: z.array(verdict).min(1) }),
]);

/** Bulk verdict override. */
export const setVerdictSchema = z.object({ ids: z.array(id).min(1).max(1000), verdict: verdict.exclude(['unchecked']) });

/** The "Add prospect" form. Only the name is required; the server normalises the rest. */
export const addProspectSchema = z.object({
  full_name: z.string().trim().min(1, 'Enter their name.').max(200),
  state: z.string().max(40).nullable().optional(),
  suburb: z.string().max(100).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  instagram: z.string().max(200).nullable().optional(),
  website: z.string().max(300).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

/** Editable prospect fields from the prospect modal. */
export const updateProspectSchema = z.object({
  id,
  patch: z.object({
    email: z.email().max(200).nullable().optional(),
    instagram_handle: z.string().regex(/^@?[A-Za-z0-9._]{1,30}$/, 'Not an Instagram handle.').nullable().optional(),
    website: z.string().max(300).nullable().optional(),
    phone: z.string().max(40).nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
    stage: z.enum(STAGES).optional(),
    reply_sentiment: z.enum(['positive', 'neutral', 'negative']).nullable().optional(),
    lost_reason: z.enum(LOST_REASONS).nullable().optional(),
    do_not_contact: z.boolean().optional(),
    // Only `true` means something: the founder vouches for a scraped address.
    confirm_email: z.literal(true).optional(),
  }),
});

/** A manual touch logged from the drawer. */
export const logTouchSchema = z.object({
  id,
  kind: z.enum(['call', 'ig_comment', 'ig_reply', 'email', 'other']),
  note: z.string().max(2000).optional(),
});

/** Mark a reply that Zebri can't see (IG, phone). */
export const markRepliedSchema = z.object({ id, channel: z.enum(['instagram', 'email', 'other']), note: z.string().max(2000).optional() });

/** Link a prospect to an existing Zebri account by email. */
export const linkUserSchema = z.object({ id, email: z.email() });

/** Act on one queued message. */
export const messageActionSchema = z.object({ messageId: id });

/** Skip an IG DM with a reason. */
export const skipIgSchema = z.object({ messageId: id, reason: z.string().min(1).max(200) });

const variantSchema = z.object({
  id: id.optional(),
  label: z.string().min(1).max(10),
  subject: z.string().max(200).nullable(),
  body: z.string().min(1, 'A variant needs a message.').max(5000),
  weight: z.number().int().min(0).max(100),
  active: z.boolean(),
});

const stepSchema = z.object({
  id: id.optional(),
  channel: z.enum(['email', 'instagram']),
  delay_days: z.number().int().min(0).max(90),
  is_new_thread: z.boolean(),
  variants: z.array(variantSchema).min(1, 'Every step needs at least one variant.').max(6),
});

/** Full sequence save (replace semantics). */
export const saveSequenceSchema = z.object({
  id: id.optional(),
  name: z.string().min(1, 'Name the sequence.').max(120),
  steps: z.array(stepSchema).min(1, 'Add at least one step.').max(10),
});

/** Campaign save. */
export const saveCampaignSchema = z.object({
  id: id.optional(),
  name: z.string().min(1, 'Name the campaign.').max(120),
  audience: z.object({
    states: z.array(z.string().max(3)).max(8).optional(),
    minScore: z.number().int().min(0).max(100).optional(),
  }),
  daily_new_enrolments: z.number().int().min(0).max(200),
  arms: z.array(z.object({ sequence_id: id, weight: z.number().int().min(0).max(100) })).min(1, 'Add at least one sequence.').max(6),
});

/** Campaign status change. */
export const campaignStatusSchema = z.object({ id, status: z.enum(['active', 'paused', 'finished']) });

/** Settings save. */
export const saveSettingsSchema = z.object({
  sender_name: z.string().max(100),
  signature: z.string().max(1000),
  email_ramp: z.array(z.number().int().min(0).max(200)).min(1).max(12),
  email_daily_cap: z.number().int().min(0).max(200),
  ig_daily_cap: z.number().int().min(0).max(200),
  send_window_start: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  send_window_end: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  send_weekdays: z.array(z.number().int().min(1).max(7)).min(1, 'Pick at least one day.'),
  apify_monthly_budget_cents: z.number().int().min(0).max(100_000),
  booking_meeting_type_id: id.nullable(),
}).refine((s) => s.send_window_end > s.send_window_start, { message: 'The window must end after it starts.', path: ['send_window_end'] });

/** Analytics filter. */
export const analyticsSchema = z.object({ campaignId: id.nullable() });
