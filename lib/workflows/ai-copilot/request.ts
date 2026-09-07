/**
 * The copilot request body, defined once for both sides of the wire.
 *
 * It lived inside the route module, where the browser could not see it
 * and nothing could compare the two halves. The client sent
 * `{ templateId, messages }` and the route parsed `{ automationId,
 * messages }`, left over from the automations to workflows rename, so
 * every message came back "Invalid request body" the moment it got past
 * the 404 that was hiding it.
 *
 * The field is `templateId` because that is what it is: the id of a row
 * in `workflow_templates`. The copilot's internal vocabulary is still
 * "automation" (its prompt and tools speak it, deliberately), but that
 * stops at the module boundary.
 *
 * @module lib/workflows/ai-copilot/request
 */

import { z } from 'zod';

/** What the panel POSTs to `/api/ai/workflow-copilot`. */
export const copilotRequestSchema = z.object({
  /** The `workflow_templates` row the conversation is about. */
  templateId: z.string().uuid(),
  /**
   * Panel-held conversation history, oldest first, last entry the new
   * user message. Bounded hard so a hostile client cannot stuff tokens.
   */
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4_000),
      }),
    )
    .min(1)
    .max(40),
});

/** The parsed body. See {@link copilotRequestSchema}. */
export type CopilotRequest = z.infer<typeof copilotRequestSchema>;
