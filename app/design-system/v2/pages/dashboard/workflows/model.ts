/**
 * The shape of a workflow in the v2 preview: a trigger, then an ordered
 * story of steps, each with its timing in plain words. It mirrors the
 * real engine (template, per-client snapshot, steps; three timing
 * modes; manual and automated steps; branches; start another workflow)
 * so nothing the production builder can express is lost, only drawn
 * differently. Wait is not a step here: timing covers it.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/model
 */

/** When a step happens, relative to the one before it or to the event. */
export type Timing =
  | { mode: 'now' }
  | { mode: 'after'; n: number; unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' }
  | { mode: 'before-event' | 'after-event'; n: number; unit: 'days' | 'weeks' | 'months' };

/** A document Zebri can send for the MC. */
export type DocKind = 'Proposal' | 'Invoice' | 'Contract' | 'Questionnaire' | 'Run sheet';

/** A step in the story. `approve` holds an automated send in Up next. */
export type Step = { id: string; timing: Timing } & (
  | { kind: 'email'; subject: string; body: string; approve: boolean }
  | { kind: 'todo'; title: string }
  | { kind: 'appointment'; title: string }
  | { kind: 'document'; doc: DocKind; approve: boolean }
  | { kind: 'stage'; stage: string }
  | { kind: 'if'; condition: string; then: Step[] }
  | { kind: 'start'; workflow: string }
);

export type StepKind = Step['kind'];

/** A client on a workflow, and how far along their copy is. */
export interface Enrolment {
  names: [string, string];
  /** "YYYY-MM-DD", or null before a date is set. */
  event: string | null;
  /** Index of their next step in the top-level story. */
  at: number;
  paused?: boolean | undefined;
}

export interface Workflow {
  id: string;
  name: string;
  on: boolean;
  trigger: { id: string; filters: string[] };
  steps: Step[];
  clients: Enrolment[];
  /** Sends in the last seven days. */
  sentThisWeek: number;
  /** When it last sent something, in words ("2h ago"); unset if never. */
  lastSent?: string | undefined;
  /** When it was turned off, in words; unset if it has never run. */
  offSince?: string | undefined;
  /**
   * Turned off with clients part-way through, who were left to finish:
   * it takes nobody new but still sends to the ones already on it.
   */
  finishing?: boolean | undefined;
  /** Something that went wrong and needs the MC, shown in the list. */
  issue?: { text: string; who: string } | undefined;
}

let seq = 0;
/** A fresh id for a step made this visit. */
export const uid = (prefix = 's') => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

const plural = (n: number, word: string) => `${n} ${word.replace(/s$/, '')}${n === 1 ? '' : 's'}`;

/** How the story's right-hand column reads a step's timing. */
export function timingWords(t: Timing): string {
  if (t.mode === 'now') return 'Straight away';
  if (t.mode === 'after') return `${plural(t.n, t.unit)} later`;
  return `${plural(t.n, t.unit)} ${t.mode === 'before-event' ? 'before' : 'after'} the event`;
}

/** The step's one line in the story. */
export function stepTitle(s: Step, workflowName: (id: string) => string): string {
  switch (s.kind) {
    case 'email':
      return `Email "${s.subject}"`;
    case 'todo':
    case 'appointment':
      return s.title;
    case 'document':
      return s.doc === 'Questionnaire' ? 'Send the questionnaire' : `Send the ${s.doc.toLowerCase()}`;
    case 'stage':
      return `Move them to ${s.stage}`;
    case 'if':
      return `If ${s.condition}`;
    case 'start':
      return `Start "${workflowName(s.workflow)}"`;
  }
}

/** Steps the MC does by hand: they hold up everything after them. */
export const isManual = (s: Step) => s.kind === 'todo' || s.kind === 'appointment';

/** Steps that send something and so can wait for approval. */
export const canApprove = (s: Step): s is Extract<Step, { approve: boolean }> =>
  s.kind === 'email' || s.kind === 'document';

/** Every step, branches included, in story order. */
export function flatSteps(steps: Step[]): Step[] {
  return steps.flatMap((s) => (s.kind === 'if' ? [s, ...flatSteps(s.then)] : [s]));
}

/** Applies `fn` to the step with `id`, wherever it sits. */
export function mapStep(steps: Step[], id: string, fn: (s: Step) => Step): Step[] {
  return steps.map((s) => {
    if (s.id === id) return fn(s);
    return s.kind === 'if' ? { ...s, then: mapStep(s.then, id, fn) } : s;
  });
}

/** Removes the step with `id`, wherever it sits. */
export function removeStep(steps: Step[], id: string): Step[] {
  return steps.filter((s) => s.id !== id).map((s) => (s.kind === 'if' ? { ...s, then: removeStep(s.then, id) } : s));
}

/**
 * Inserts `step` at `index` in the list owned by `parent` (the top-level
 * story when `parent` is null, else that branch).
 */
export function insertStep(steps: Step[], parent: string | null, index: number, step: Step): Step[] {
  if (parent === null) return [...steps.slice(0, index), step, ...steps.slice(index)];
  return steps.map((s) =>
    s.id === parent && s.kind === 'if'
      ? { ...s, then: [...s.then.slice(0, index), step, ...s.then.slice(index)] }
      : s.kind === 'if'
        ? { ...s, then: insertStep(s.then, parent, index, step) }
        : s,
  );
}
