import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildCopilotRequest,
  COPILOT_ENDPOINT,
} from '@/app/(dashboard)/workflows/[id]/use-copilot-chat';
import { copilotRequestSchema } from '@/lib/workflows/ai-copilot/request';

/**
 * The copilot's fetch URL has to name a route that exists.
 *
 * It did not, for the whole life of the automations → workflows rename:
 * the route moved to `app/api/ai/workflow-copilot` and the client kept
 * posting to `/api/ai/automation-copilot`. Every send 404'd, and a 404
 * is `!res.ok`, so the panel showed "Something went wrong. Please try
 * again." and nothing else.
 *
 * Behind it was the same drift in the body: the client sent
 * `templateId`, the route parsed `automationId`, and every message that
 * got past the 404 came back "Invalid request body".
 *
 * The existing integration test could not catch either half. It imports
 * `POST` and calls the handler directly with a body it writes itself,
 * which is the right way to test a route's behaviour and the exact
 * reason it never exercises the URL or the payload the browser actually
 * sends. Nothing in the suite joined the two halves, so this file
 * checks the seam itself: the path must resolve to a route file, and
 * the body the client builds must satisfy the schema the route parses.
 */
describe('the Zebri AI copilot endpoint', () => {
  it('resolves to a route handler that exists', () => {
    expect(COPILOT_ENDPOINT.startsWith('/api/')).toBe(true);
    const routeFile = join(process.cwd(), 'app', `${COPILOT_ENDPOINT}`, 'route.ts');
    expect(existsSync(routeFile), `no route handler at ${routeFile}`).toBe(true);
  });

  it('sends a body the route can parse', () => {
    const body = buildCopilotRequest('11111111-2222-4333-8444-555555555555', [
      { role: 'user', content: 'Add a welcome email' },
    ]);
    expect(copilotRequestSchema.safeParse(body).success).toBe(true);
  });

  it('sends a body the route can parse with history in front of it', () => {
    const body = buildCopilotRequest('11111111-2222-4333-8444-555555555555', [
      { role: 'user', content: 'Add a welcome email' },
      { role: 'assistant', content: 'Added it.' },
      { role: 'user', content: 'Now wait 20 minutes first' },
    ]);
    expect(copilotRequestSchema.safeParse(body).success).toBe(true);
  });
});
