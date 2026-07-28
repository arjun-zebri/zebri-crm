/**
 * Request schema for the public questionnaire write endpoints (save + submit).
 *
 * Both take a UUID share token and a validated responses map. Kept separate
 * from `question-schema` so the API routes import only what they need.
 *
 * @module lib/questionnaires/api-schema
 */

import { z } from 'zod'

import { responsesSchema } from './question-schema'

/** Body for `/api/questionnaire/save` and `/api/questionnaire/submit`. */
export const questionnaireWriteSchema = z.object({
  token: z.uuid('Token must be a UUID'),
  responses: responsesSchema,
})

/** Parsed write request. */
export type QuestionnaireWriteBody = z.infer<typeof questionnaireWriteSchema>
