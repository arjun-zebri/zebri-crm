/**
 * What a stored step is called, on any list that shows one.
 *
 * A step's `title` column is whatever the MC typed into the builder,
 * and the builder only asks for a name on the manual steps: for a send,
 * the name IS the action ("Send email"), so nobody types one and the
 * column is `''`. Every list then rendered a blank row - and on the
 * Upcoming queue the row's only click target was that empty label, so
 * the step could not even be opened.
 *
 * The canvas has always had an answer to this question
 * (`stepTitle` in `app/(dashboard)/workflows/[id]/step-summary.ts`) but
 * it reads template rows and never left the builder. This is the same
 * answer for the snapshotted instance rows the MC actually works, and
 * it belongs in the loaders rather than in each row component, so the
 * queue, the detail modal and the couple's checklist cannot drift into
 * calling one step three things.
 *
 * @module lib/workflows/step-label
 */

import { configWithDefaults } from '@/lib/automations/action-defaults';
import { actionUi } from '@/lib/automations/actions/ui';
import type { ActionType } from '@/types/automations';

/** The parts of a step row this needs. */
export interface StepLabelInput {
  /** The stored title. Empty for anything the MC did not name. */
  title: string | null;
  /** The native step type (`action`, `todo`, `wait`, …). */
  type: string;
  /** The step's config; an `action` carries its slug in `actionType`. */
  config: unknown;
}

/** Names for the step types that are not actions. */
const NATIVE_LABELS: Readonly<Record<string, string>> = {
  todo: 'To-do',
  appointment: 'Appointment',
  wait: 'Wait',
  branch: 'Branch',
  stop: 'Stop',
  approval: 'Approval',
  sub_flow: 'Run another workflow',
};

/** Longest detail we will append before eliding. */
const DETAIL_MAX = 60;

function str(config: Record<string, unknown>, key: string): string {
  const raw = config[key];
  return typeof raw === 'string' ? raw.trim() : '';
}

function truncate(value: string): string {
  return value.length > DETAIL_MAX ? `${value.slice(0, DETAIL_MAX - 1)}…` : value;
}

/**
 * The one thing that tells two steps of the same kind apart.
 *
 * A day with three "Send email" rows is a day the MC has to open three
 * modals to read. The subject (or, for a to-do the runner creates, its
 * title) is what makes the row answerable at a glance.
 */
function detailFor(config: Record<string, unknown>): string {
  return str(config, 'subject') || str(config, 'title');
}

/**
 * The label for one step. See {@link StepLabelInput}.
 *
 * The stored title always wins: it is the MC's own words. Everything
 * else falls back to what the step does, and finally to "Step", which
 * is still a row that can be clicked.
 */
export function stepDisplayTitle(step: StepLabelInput): string {
  const stored = step.title?.trim() ?? '';
  if (stored) return stored;

  const config = (step.config ?? {}) as Record<string, unknown>;

  // An `action` row keeps its real slug in the config; every other type
  // is its own answer.
  const slug =
    step.type === 'action' && typeof config['actionType'] === 'string'
      ? (config['actionType'] as string)
      : step.type;

  const native = NATIVE_LABELS[slug];
  if (native) return native;

  const ui = actionUi[slug as ActionType];
  if (!ui) return 'Step';

  // Read through the schema: the post-event sends store `{}` and carry
  // their subject as a Zod default, so the raw config of a fully
  // written email looks empty.
  const detail = detailFor(configWithDefaults(slug, config));
  return detail ? `${ui.label} · ${truncate(detail)}` : ui.label;
}
