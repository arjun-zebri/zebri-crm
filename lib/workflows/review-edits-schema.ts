/**
 * The shape of an MC's edits to a held send, as the server actions
 * accept them.
 *
 * In a plain module rather than beside the actions: a `'use server'` file
 * may export only async functions, and three actions (preview, approve,
 * save) validate the same edits.
 *
 * @module lib/workflows/review-edits-schema
 */

import { z } from 'zod';

/**
 * A body is a TipTap doc. Bounded so a pasted novel cannot make each
 * debounced preview a large render; the same cap as the Compose preview.
 */
const MAX_DOC_CHARS = 200_000;

/**
 * Per-field edits (see `ReviewEdits` in `./review`): each field is present
 * only when the MC changed it. The subject cap is the send's own
 * (`sendEmailConfigSchema`), so an edit the send would reject at run
 * time is refused here, in words, instead.
 */
export const reviewEditsSchema = z.object({
  subject: z.string().max(200, 'The subject can be at most 200 characters.').optional(),
  content: z
    .record(z.string(), z.unknown())
    .refine((doc) => doc['type'] === 'doc', { message: 'The message could not be read.' })
    .refine((doc) => JSON.stringify(doc).length <= MAX_DOC_CHARS, {
      message: 'The message is too long.',
    })
    .optional(),
});
