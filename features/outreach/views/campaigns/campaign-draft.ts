/**
 * Editor state and pure helpers for campaigns: the draft, the save
 * payload, the arm split, and the status labels.
 *
 * @module features/outreach/views/campaigns/campaign-draft
 */
import type { CampaignSummary } from '@/lib/outreach/services/queries';

/** Australian states and territories, as stored on prospects. */
export const STATE_OPTIONS = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;

/** One sequence in a campaign, with its weight. */
export interface DraftArm {
  sequence_id: string;
  weight: number;
}

/** A campaign as edited. `minScore` is null for "no minimum". */
export interface DraftCampaign {
  id?: string;
  name: string;
  states: string[];
  minScore: number | null;
  daily_new_enrolments: number;
  arms: DraftArm[];
}

/** Payload for saveCampaignAction, matching saveCampaignSchema. */
export interface SaveCampaignPayload {
  id?: string;
  name: string;
  audience: { states?: string[]; minScore?: number };
  daily_new_enrolments: number;
  arms: DraftArm[];
}

/** Audience in the shape countAudienceAction expects. */
export interface AudiencePayload {
  states?: string[];
  minScore?: number;
}

/** A starting campaign: nothing selected, so the audience is every active celebrant. */
export function blankCampaign(): DraftCampaign {
  return { name: '', states: [], minScore: null, daily_new_enrolments: 10, arms: [] };
}

/** Read the audience JSON safely. The column is untyped, so a bad row degrades to "everyone". */
function readAudience(raw: unknown): { states: string[]; minScore: number | null } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { states: [], minScore: null };
  const rec = raw as Record<string, unknown>;
  const states = Array.isArray(rec.states) ? rec.states.filter((s): s is string => typeof s === 'string') : [];
  const minScore = typeof rec.minScore === 'number' ? rec.minScore : null;
  return { states, minScore };
}

/** Turn a saved campaign into an editable draft. */
export function draftFromCampaign(c: CampaignSummary): DraftCampaign {
  const { states, minScore } = readAudience(c.audience);
  return {
    id: c.id,
    name: c.name,
    states,
    minScore,
    daily_new_enrolments: c.daily_new_enrolments,
    arms: c.arms.map((a) => ({ sequence_id: a.sequence_id, weight: a.weight })),
  };
}

/** The audience as the server takes it. Empty fields are left out, not sent as null. */
export function audienceOf(draft: Pick<DraftCampaign, 'states' | 'minScore'>): AudiencePayload {
  return {
    ...(draft.states.length > 0 ? { states: draft.states } : {}),
    ...(draft.minScore !== null ? { minScore: draft.minScore } : {}),
  };
}

/** Convert a draft into the saveCampaignAction payload. */
export function toCampaignPayload(draft: DraftCampaign): SaveCampaignPayload {
  return {
    ...(draft.id ? { id: draft.id } : {}),
    name: draft.name.trim(),
    audience: audienceOf(draft),
    daily_new_enrolments: draft.daily_new_enrolments,
    arms: draft.arms,
  };
}

/** Plain-language problems that would block saving. Activation problems come back from the server as toasts. */
export function campaignProblems(draft: DraftCampaign): string[] {
  const problems: string[] = [];
  if (!draft.name.trim()) problems.push('Name the campaign.');
  if (draft.arms.length === 0) problems.push('Pick at least one sequence.');
  else if (draft.arms.every((a) => a.weight === 0)) problems.push('Give at least one sequence a share above 0.');
  return problems;
}

/**
 * Share of new people each selected sequence receives, as whole percents.
 * Weights are relative, so 1 and 1 give 50% each. Returns 0 for every
 * sequence when all weights are zero, rather than dividing by zero.
 */
export function splitPercent(arms: DraftArm[]): Map<string, number> {
  const total = arms.reduce((sum, a) => sum + a.weight, 0);
  return new Map(arms.map((a) => [a.sequence_id, total > 0 ? Math.round((a.weight / total) * 100) : 0]));
}

/** Status pill label and tone for a campaign status. */
export const STATUS_META: Record<string, { label: string; tone: 'neutral' | 'success' | 'warning' }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  active: { label: 'Active', tone: 'success' },
  paused: { label: 'Paused', tone: 'warning' },
  finished: { label: 'Finished', tone: 'neutral' },
};

/**
 * True when the editor's draft differs from the state it opened with.
 * Compares the whole draft, so a change and an undo back to the start
 * count as clean.
 *
 * @param draft - Current editor state.
 * @param initial - The state the editor opened with.
 */
export function isDraftDirty(draft: DraftCampaign, initial: DraftCampaign): boolean {
  return JSON.stringify(draft) !== JSON.stringify(initial);
}
