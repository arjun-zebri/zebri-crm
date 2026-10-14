/**
 * Instagram profile lookups through Apify's `instagram-profile-scraper`.
 *
 * Meta offers no API for reading arbitrary public profiles, so this is
 * the one paid dependency in outreach. Spend is bounded twice: callers
 * only send handles the website check couldn't settle, and
 * {@link estimateCostCents} is charged against the monthly cap before a
 * run starts.
 *
 * Runs are asynchronous: {@link startProfileRun} returns a run id, the
 * tick polls {@link getRun}, and {@link fetchProfiles} reads the dataset
 * once it has succeeded. Polling (not Apify's webhook) keeps outreach
 * free of a public inbound endpoint.
 *
 * Server-only: reads `APIFY_TOKEN`.
 *
 * @module lib/outreach/checks/instagram-apify
 */

const API = 'https://api.apify.com/v2';
const ACTOR = 'apify~instagram-profile-scraper';

/**
 * Planning price per profile in US cents (about US$2.30 per 1,000).
 * Only used to pre-check the monthly cap; the run's real `usageTotalUsd`
 * is what gets recorded once it finishes.
 */
export const EST_CENTS_PER_PROFILE = 0.23;

/** Most handles sent in one Apify run. */
export const MAX_HANDLES_PER_RUN = 1_000;

/** A profile as stored on the prospect. */
export interface IgProfile {
  handle: string;
  status: 'ok' | 'not_found' | 'private';
  lastPostAt: string | null;
  followers: number | null;
  posts: number | null;
  bio: string | null;
  isPrivate: boolean | null;
}

/** Apify run state, narrowed to what the tick acts on. */
export interface ApifyRun {
  id: string;
  status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED' | 'TIMED-OUT' | string;
  datasetId: string;
  usageTotalUsd: number | null;
}

/** Thrown when Apify is misconfigured or answers with an error. */
export class ApifyError extends Error {}

function token(): string {
  const t = process.env.APIFY_TOKEN;
  if (!t) throw new ApifyError('APIFY_TOKEN is not set');
  return t;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json', ...init?.headers },
  });
  if (!res.ok) throw new ApifyError(`Apify ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

/** Projected cost of looking up `count` profiles, rounded up to whole cents. */
export function estimateCostCents(count: number): number {
  return Math.ceil(count * EST_CENTS_PER_PROFILE);
}

interface RawRun {
  data: { id: string; status: string; defaultDatasetId: string; usageTotalUsd?: number };
}

function toRun(raw: RawRun): ApifyRun {
  return {
    id: raw.data.id,
    status: raw.data.status,
    datasetId: raw.data.defaultDatasetId,
    usageTotalUsd: raw.data.usageTotalUsd ?? null,
  };
}

/** Start a lookup for up to {@link MAX_HANDLES_PER_RUN} handles. */
export async function startProfileRun(handles: string[]): Promise<ApifyRun> {
  if (handles.length === 0) throw new ApifyError('no handles');
  if (handles.length > MAX_HANDLES_PER_RUN) throw new ApifyError('too many handles for one run');
  return toRun(await call<RawRun>(`/acts/${ACTOR}/runs`, {
    method: 'POST',
    body: JSON.stringify({ usernames: handles }),
  }));
}

/** Current state of a run. */
export async function getRun(runId: string): Promise<ApifyRun> {
  return toRun(await call<RawRun>(`/actor-runs/${encodeURIComponent(runId)}`));
}

/** Raw dataset item, only the fields we read. */
export interface RawIgItem {
  username?: string;
  inputUrl?: string;
  error?: string;
  followersCount?: number;
  postsCount?: number;
  biography?: string;
  private?: boolean;
  latestPosts?: { timestamp?: string }[];
}

/** Normalise one dataset item; exported for tests. */
export function parseItem(item: RawIgItem): IgProfile | null {
  const handle = (item.username ?? item.inputUrl?.split('/').filter(Boolean).pop() ?? '').toLowerCase();
  if (!handle) return null;
  if (item.error || item.followersCount === undefined) {
    return { handle, status: 'not_found', lastPostAt: null, followers: null, posts: null, bio: null, isPrivate: null };
  }
  const times = (item.latestPosts ?? [])
    .map((p) => (p.timestamp ? Date.parse(p.timestamp) : NaN))
    .filter((t) => !Number.isNaN(t));
  return {
    handle,
    status: item.private ? 'private' : 'ok',
    lastPostAt: times.length ? new Date(Math.max(...times)).toISOString() : null,
    followers: item.followersCount ?? null,
    posts: item.postsCount ?? null,
    bio: item.biography?.slice(0, 500) ?? null,
    isPrivate: item.private ?? null,
  };
}

/** Read a finished run's profiles, keyed by lower-cased handle. */
export async function fetchProfiles(datasetId: string): Promise<Map<string, IgProfile>> {
  const items = await call<RawIgItem[]>(`/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json`);
  const out = new Map<string, IgProfile>();
  for (const item of items) {
    const p = parseItem(item);
    if (p) out.set(p.handle, p);
  }
  return out;
}
