/**
 * Unit tests for the Tasks Tracker create-page call.
 *
 * The payload shape is the whole risk surface: `Status` is a Notion *status*
 * property while `Priority`, `Sprint`, `Type` and `Repo` are selects, and
 * sending the wrong key is valid JSON that Notion rejects at runtime.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TicketBody } from '@/lib/notion/blocks';
import { NotionApiError } from '@/lib/notion/client';
import { createTask, readTicketRef } from '@/lib/notion/create-task';

const body: TicketBody = {
  description: 'Pressed send and nothing arrived.',
  summary: 'Contract emails are not sending',
  pageUrl: 'https://app.zebri.com.au/payments',
  routePath: '/payments',
  browser: 'Chrome 141 on macOS',
  viewport: '1512 x 857',
  buildSha: 'a1b2c3d',
  account: 'marianna@example.com',
};

const input = {
  title: 'Contract emails are not sending',
  type: 'Bug' as const,
  reporter: 'Marianna (marianna@example.com)',
  body,
};

function pageResponse(over: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      id: 'page-1',
      url: 'https://notion.so/page-1',
      properties: { 'Ticket ID': { type: 'unique_id', unique_id: { prefix: 'ZEB', number: 42 } } },
      ...over,
    }),
  };
}

/** The parsed body of the single fetch call made by createTask. */
function sentBody(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(fetchMock.mock.calls[0]![1].body);
}

describe('createTask', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.NOTION_API_KEY = 'secret';
    process.env.NOTION_TASKS_DATA_SOURCE_ID = 'ds-1';
    fetchMock = vi.fn().mockResolvedValue(pageResponse());
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NOTION_API_KEY;
    delete process.env.NOTION_TASKS_DATA_SOURCE_ID;
  });

  it('posts to the pages endpoint with the pinned API version', async () => {
    await createTask(input);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.notion.com/v1/pages');
    expect(init.headers['Notion-Version']).toBe('2025-09-03');
    expect(init.headers.Authorization).toBe('Bearer secret');
  });

  it('parents the page on the data source, not a database', async () => {
    await createTask(input);
    expect(sentBody(fetchMock).parent).toEqual({
      type: 'data_source_id',
      data_source_id: 'ds-1',
    });
  });

  it('sends Status as a status property and the rest as selects', async () => {
    await createTask(input);
    const { properties } = sentBody(fetchMock);
    expect(properties.Status).toEqual({ status: { name: 'Triage' } });
    expect(properties.Priority).toEqual({ select: { name: 'Medium' } });
    expect(properties.Sprint).toEqual({ select: { name: 'User submitted tickets' } });
    expect(properties.Type).toEqual({ select: { name: 'Bug' } });
    expect(properties.Repo).toEqual({ select: { name: 'zebri-app' } });
  });

  it('leaves Area and Slug for triage', async () => {
    await createTask(input);
    const { properties } = sentBody(fetchMock);
    expect(properties.Area).toBeUndefined();
    expect(properties.Slug).toBeUndefined();
  });

  it('truncates the Description property but not the page body', async () => {
    await createTask({ ...input, body: { ...body, description: 'x'.repeat(400) } });
    const sent = sentBody(fetchMock);
    const preview = sent.properties.Description.rich_text[0].text.content;
    expect(preview.length).toBeLessThanOrEqual(200);
    expect(preview.endsWith('…')).toBe(true);
    expect(JSON.stringify(sent.children)).toContain('x'.repeat(400));
  });

  it('returns the ticket reference from the created page', async () => {
    await expect(createTask(input)).resolves.toEqual({
      pageId: 'page-1',
      pageUrl: 'https://notion.so/page-1',
      ticketRef: 'ZEB-42',
    });
  });

  it('throws a typed error when Notion refuses', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({ code: 'rate_limited', message: 'slow down' }),
    });
    await expect(createTask(input)).rejects.toBeInstanceOf(NotionApiError);
    await expect(createTask(input)).rejects.toMatchObject({ status: 429, retryable: true });
  });

  it('treats a 400 as not worth retrying', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ code: 'validation_error', message: 'Sprint is not a property' }),
    });
    await expect(createTask(input)).rejects.toMatchObject({ retryable: false });
  });

  it('fails loudly when the token is missing rather than 401-ing at Notion', async () => {
    delete process.env.NOTION_API_KEY;
    await expect(createTask(input)).rejects.toMatchObject({ code: 'missing_token' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('readTicketRef', () => {
  it('joins the prefix and number', () => {
    expect(readTicketRef({ 'Ticket ID': { unique_id: { prefix: 'ZEB', number: 7 } } })).toBe(
      'ZEB-7',
    );
  });

  it('falls back to the bare number when Notion has no prefix set', () => {
    expect(readTicketRef({ 'Ticket ID': { unique_id: { prefix: null, number: 7 } } })).toBe('7');
  });

  it('returns null rather than throwing when the property is absent', () => {
    expect(readTicketRef({})).toBeNull();
    expect(readTicketRef({ 'Ticket ID': { unique_id: {} } })).toBeNull();
  });
});
