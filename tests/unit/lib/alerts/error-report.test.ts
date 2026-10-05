/**
 * Unit tests for the pure error-report helpers: error-shape extraction,
 * page redaction, browser naming and the Sydney timestamp.
 *
 * @module tests/unit/lib/alerts/error-report.test
 */
import { describe, expect, it } from 'vitest';

import {
  clientErrorReportSchema,
  describeBrowser,
  describeBuild,
  errorFields,
  redactPage,
  sydneyTime,
} from '@/lib/alerts/error-report';

describe('errorFields', () => {
  it('reads a PostgrestError, which is a plain object, not an Error', () => {
    expect(
      errorFields({
        message: 'insert or update on table "automation_events" violates foreign key constraint',
        code: '23503',
        details: 'Key (couple_id)=(x) is not present in table "couples".',
        hint: null,
      }),
    ).toEqual({
      message: 'insert or update on table "automation_events" violates foreign key constraint',
      code: '23503',
      detail: 'Key (couple_id)=(x) is not present in table "couples".',
    });
  });

  it('reads an Error and a string', () => {
    expect(errorFields(new Error('Could not delete couple.'))).toEqual({
      message: 'Could not delete couple.',
    });
    expect(errorFields('boom')).toEqual({ message: 'boom' });
  });

  it('never returns "[object Object]" for an unknown shape', () => {
    expect(errorFields({ status: 500 }).message).toBe('{"status":500}');
    expect(errorFields(undefined).message).toBe('(no error object)');
  });
});

describe('redactPage', () => {
  it('keeps an ordinary page and its query', () => {
    expect(redactPage('/couples?view=board')).toBe('/couples?view=board');
  });

  it('shortens tokens in the path and query', () => {
    expect(redactPage('/invoice/0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d')).toBe('/invoice/0b1c2d…');
    expect(redactPage('/portal?token=abcdefghijklmnopqrstuvwxyz')).toBe('/portal?token=abcdef…');
  });

  it('drops email-shaped values', () => {
    expect(redactPage('/contacts?q=jo@example.com')).toBe('/contacts?q=[redacted]');
  });
});

describe('describeBrowser', () => {
  it('names Chrome on Windows', () => {
    expect(
      describeBrowser(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome 154 · Windows');
  });

  it('names Safari on iOS and Edge before Chrome', () => {
    expect(
      describeBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari 18 · iOS');
    expect(
      describeBrowser(
        'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0 Safari/537.36 Edg/150.0',
      ),
    ).toBe('Edge 150 · Windows');
  });

  it('handles a missing user agent', () => {
    expect(describeBrowser(null)).toBe('unknown browser');
  });
});

describe('describeBuild and sydneyTime', () => {
  it('shortens the commit and names the environment', () => {
    expect(
      describeBuild({ VERCEL_GIT_COMMIT_SHA: 'b0c5991807600664', VERCEL_ENV: 'production' } as unknown as NodeJS.ProcessEnv),
    ).toBe('b0c5991 · production');
  });

  it('labels the time with its Sydney zone', () => {
    expect(sydneyTime(new Date('2026-10-02T04:24:35Z'))).toMatch(/2 Oct 2026.*2:24:35.*pm AEST/);
  });
});

describe('clientErrorReportSchema', () => {
  it('rejects an arbitrary Slack payload, the old relay shape', () => {
    expect(clientErrorReportSchema.safeParse({ text: 'hi', blocks: [] }).success).toBe(false);
  });
});
