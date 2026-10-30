/**
 * Zod input schema for `createProposalFromTemplateAction`. A plain module
 * (not `'use server'`) because value exports from an actions file compile
 * but throw at runtime (`npm run check:server-action-exports`).
 *
 * @module app/(dashboard)/proposals/create-from-template-schema
 */
import { z } from 'zod';

/**
 * Input to `createProposalFromTemplateAction`.
 *
 * `templateId: null` means "whichever template this account would use by
 * default", resolved server-side, so the New Proposal flow can create one
 * without first loading the template list. `expiresAt: null` means "work
 * it out from the settings' expiry days", for the same reason.
 */
export const createProposalFromTemplateSchema = z.object({
  coupleId: z.uuid(),
  templateId: z.uuid().nullable(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

/** Parsed input to `createProposalFromTemplateAction`. */
export type CreateProposalFromTemplateInput = z.infer<typeof createProposalFromTemplateSchema>;
