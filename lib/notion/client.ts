/**
 * Thin Notion REST client.
 *
 * Three endpoints do not justify a dependency, and pinning the API version by
 * hand is what makes the data-source parent shape work: creating a page under
 * a *data source* rather than a database requires `2025-09-03` or newer, and
 * the SDK's pinned version lags.
 *
 * Every call is time-boxed. Notion is a third party on the critical path of a
 * user-facing request, so a hung socket must fail fast rather than hold the
 * MC's submit button spinning until the platform timeout.
 *
 * @module lib/notion/client
 */

/** Notion API version this client speaks. Data-source parents need >= this. */
export const NOTION_VERSION = '2025-09-03';

const NOTION_BASE_URL = 'https://api.notion.com/v1';

/** How long any single Notion call may take before we give up. */
const REQUEST_TIMEOUT_MS = 8_000;

/**
 * A failed Notion call, carrying enough to decide whether it was our fault.
 *
 * `status` is 0 when the request never got a response (timeout, DNS, socket).
 */
export class NotionApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'NotionApiError';
    this.status = status;
    this.code = code;
  }

  /** True when retrying later could plausibly succeed. */
  get retryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

/** Reads the integration token, failing loudly rather than 401-ing at Notion. */
export function notionApiKey(): string {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new NotionApiError('NOTION_API_KEY is not set', 0, 'missing_token');
  return key;
}

/** Reads the Tasks Tracker data source id. */
export function notionTasksDataSourceId(): string {
  const id = process.env.NOTION_TASKS_DATA_SOURCE_ID;
  if (!id) {
    throw new NotionApiError('NOTION_TASKS_DATA_SOURCE_ID is not set', 0, 'missing_data_source');
  }
  return id;
}

/** Runs `fetch` under an abort timer, mapping every failure to NotionApiError. */
async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new NotionApiError(`Notion request failed: ${reason}`, 0, 'network');
  } finally {
    clearTimeout(timer);
  }
}

/** Pulls Notion's `{ code, message }` out of an error body, best effort. */
async function readError(response: Response): Promise<NotionApiError> {
  let code = 'unknown';
  let message = response.statusText;
  try {
    const body = (await response.json()) as { code?: string; message?: string };
    if (body.code) code = body.code;
    if (body.message) message = body.message;
  } catch {
    // Notion returned something that is not JSON. Status alone is the signal.
  }
  return new NotionApiError(message, response.status, code);
}

/**
 * Calls a Notion JSON endpoint and returns the parsed body.
 *
 * @throws {NotionApiError} on any non-2xx response or transport failure.
 */
export async function notionFetch<T>(
  path: string,
  body: unknown,
  apiKey = notionApiKey(),
): Promise<T> {
  const response = await timedFetch(`${NOTION_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as T;
}

/**
 * Uploads raw bytes to a Notion-issued upload URL.
 *
 * Separate from {@link notionFetch} because this one is multipart, not JSON,
 * and must not carry a `Content-Type` header of its own: the boundary is set
 * by the runtime when it serialises the FormData.
 */
export async function notionUpload(
  uploadUrl: string,
  file: File,
  apiKey = notionApiKey(),
): Promise<void> {
  const form = new FormData();
  form.append('file', file, file.name);
  const response = await timedFetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Notion-Version': NOTION_VERSION,
    },
    body: form,
  });
  if (!response.ok) throw await readError(response);
}
