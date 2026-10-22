import { CONTRACT } from './contract';
import { EMAIL } from './email';
import { INVOICE } from './invoice';
import { RUN_SHEET, SCRIPT } from './night';
import { PROPOSAL } from './proposal';
import { QUESTIONNAIRE } from './questionnaire';
import type { DesignKind, DesignSpec } from './spec';

/**
 * Every designable document by kind.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/docs/registry
 */

// Each spec's data type differs; the registry hands them out by kind and
// callers pass the matching data (see `DesignData`).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SPECS: Record<DesignKind, DesignSpec<any>> = {
  proposal: PROPOSAL,
  invoice: INVOICE,
  contract: CONTRACT,
  questionnaire: QUESTIONNAIRE,
  'run-sheet': RUN_SHEET,
  script: SCRIPT,
  email: EMAIL,
};
