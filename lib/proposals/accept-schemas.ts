/**
 * Zod schemas for the public proposal-close routes: `POST
 * /api/proposal/accept` and `POST /api/proposal/decline`.
 *
 * Plain module (no `'use server'`): both routes and their unit tests import
 * these directly, and a schema file must stay import-safe from a route
 * handler's module graph.
 *
 * @module lib/proposals/accept-schemas
 */
import { z } from 'zod'

import { DECLINE_REASONS } from './close-types'

/** Body of `POST /api/proposal/accept`. */
export const acceptBodySchema = z.object({
  token: z.uuid(),
  optionId: z.uuid(),
  // Capped at 20: no proposal option offers anywhere near that many
  // add-ons, so a larger array is a malformed or hostile request.
  addonIds: z.array(z.uuid()).max(20).default([]),
})

/** Body of `POST /api/proposal/decline`. */
export const declineBodySchema = z.object({
  token: z.uuid(),
  reason: z.enum(DECLINE_REASONS),
  // Matches the RPC's `left(p_message, 1000)` truncation, so a client sees
  // its input rejected here rather than silently cut server-side.
  message: z.string().trim().max(1000).optional(),
})
