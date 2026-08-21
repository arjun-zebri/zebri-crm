/**
 * Zod schema for the public slots API query parameters.
 *
 * Plain module: exports only types and the schema for use by route.ts.
 * The route file must not re-export this schema (see the memory note
 * about directive file exports causing runtime crashes).
 *
 * @module app/api/booking/slots-schema
 */

import { z } from 'zod';

/**
 * Query schema for GET /api/booking/slots.
 * Accepts EITHER `token` (share token) OR `manageToken` (booking manage token),
 * exactly one required. Validates UUID format and ISO date range (from/to),
 * and enforces a 31-day maximum range via refine.
 */
export const slotsQuerySchema = z
  .object({
    token: z.string().uuid('token must be a valid UUID').optional(),
    manageToken: z.string().uuid('manageToken must be a valid UUID').optional(),
    from: z.string().date('from must be YYYY-MM-DD'),
    to: z.string().date('to must be YYYY-MM-DD'),
  })
  .refine((data) => {
    // Exactly one of token or manageToken must be provided
    const hasToken = data.token !== undefined && data.token !== '';
    const hasManageToken = data.manageToken !== undefined && data.manageToken !== '';
    return hasToken !== hasManageToken; // XOR: one must be true, the other false
  }, {
    message: 'exactly one of token or manageToken must be provided',
    path: ['token'],
  })
  .refine((data) => data.to >= data.from, {
    message: 'to must not be before from',
    path: ['to'],
  })
  .refine((data) => {
    const fromDate = new Date(data.from);
    const toDate = new Date(data.to);
    const diffMs = toDate.getTime() - fromDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays <= 31;
  }, {
    message: 'range must not exceed 31 days',
    path: ['to'],
  });

export type SlotsQuery = z.infer<typeof slotsQuerySchema>;
