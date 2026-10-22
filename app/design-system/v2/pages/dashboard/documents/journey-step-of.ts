import type { Journey, StepKind } from '../journeys/journeys-data';

import type { TemplateRow } from './kind-section';
import type { DocumentKind } from './kinds';

/**
 * Where the MC's journey sends a kind of document, for its section on
 * the Documents page: the step's number, counted from 1, and which of
 * the kind's templates it sends (the one named in the step, else the
 * first), so the page can say "Step 2 of your journey" on that row, or
 * "Step 3 of your journey is waiting on this" when there is no template.
 *
 * @module app/design-system/v2/pages/dashboard/documents/journey-step-of
 */

const STEP_KIND: Record<Exclude<DocumentKind, 'paperwork'>, StepKind> = {
  proposals: 'proposal',
  contracts: 'contract',
  invoices: 'invoice',
  questionnaires: 'questionnaire',
  emails: 'email',
};

/** The step on the journey new enquiries start on (else the first) that sends `kind`, or null. */
export function journeyStepOf(journeys: Journey[], kind: DocumentKind, rows: TemplateRow[]) {
  const journey = journeys.find((j) => j.starts) ?? journeys[0];
  if (!journey || kind === 'paperwork') return null;
  const at = journey.steps.findIndex((s) => s.kind === STEP_KIND[kind]);
  if (at === -1) return null;
  const detail = journey.steps[at]!.detail;
  // A journey sends many emails, each its own words, so an email row is only marked when the step names it.
  const row = rows.find((r) => r.name === detail) ?? (kind === 'emails' ? undefined : rows[0]);
  return { key: row?.key ?? null, step: at + 1 };
}
