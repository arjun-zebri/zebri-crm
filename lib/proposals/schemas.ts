/**
 * Zod schemas for the proposal server actions.
 *
 * Kept in a plain module: exporting a schema from a `'use server'` file
 * compiles but throws at runtime (see `check:server-action-exports`).
 *
 * @module lib/proposals/schemas
 */
import type { JSONContent } from '@tiptap/core';
import { z } from 'zod';

import type { SaveProposalInput } from './types';

/**
 * How many packages one proposal may carry.
 *
 * D7 originally capped this at three, when the MC hand-built every option
 * in the builder modal. Packages now live in the template's own packages
 * section, which authors up to `PACKAGE_LIMITS.maxOptions` (6) cards, and
 * creating a proposal from a template copies every card into a
 * `proposal_options` row. A lower cap here would make a proposal seeded
 * from a four-card template impossible to save again, so the two limits
 * are kept in step. The number is repeated rather than imported because
 * `lib/` must not depend on `features/`.
 */
export const MAX_OPTIONS = 6;

const itemSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(500),
  note: z.string().max(2000).nullable(),
  amount: z.number().min(0),
  quantity: z.number().min(0.01).max(999),
  isAddon: z.boolean(),
  defaultIncluded: z.boolean(),
  position: z.number().int(),
});

const optionSchema = z.object({
  id: z.string().min(1),
  position: z.number().int(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  sourcePackageId: z.uuid().nullable(),
  pricingMode: z.enum(['itemised', 'single']),
  fixedPrice: z.number().min(0).nullable(),
  gstInclusive: z.boolean(),
  weekendLoadingPercent: z.number().min(0).max(100).nullable(),
  isPopular: z.boolean(),
  items: z.array(itemSchema).max(100),
});

const heroOverrideSchema = z.object({
  imagePath: z.string().max(500).optional(),
  videoPath: z.string().max(500).optional(),
  embedUrl: z.url().max(500).optional(),
});

/** Schema for saving or updating a proposal with options and pricing. */
export const saveProposalSchema: z.ZodType<SaveProposalInput> = z.object({
  proposalId: z.uuid().nullable(),
  coupleId: z.uuid(),
  eventId: z.uuid().nullable(),
  title: z.string().min(1).max(200),
  introNote: z.custom<JSONContent>((v) => typeof v === 'object' && v !== null && !Array.isArray(v)).nullable(),
  heroOverride: heroOverrideSchema.nullable(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  depositPercent: z.number().min(0).max(100).nullable(),
  paymentScheduleId: z.uuid().nullable(),
  contractTemplateId: z.uuid().nullable(),
  options: z.array(optionSchema).max(MAX_OPTIONS),
});
