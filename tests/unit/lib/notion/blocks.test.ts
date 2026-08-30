/**
 * Unit tests for the Notion ticket body builder.
 *
 * Two things matter here and neither is visible until Notion rejects a page:
 * the 2000-character rich-text limit, and the heading sequence that
 * `/file-concern` and `/pick-ticket` both read.
 */
import { describe, expect, it } from 'vitest';

import { buildTicketBlocks, chunkText, type TicketBody } from '@/lib/notion/blocks';

const body = (over: Partial<TicketBody> = {}): TicketBody => ({
  description: 'Pressed send and nothing arrived.',
  summary: 'Contract emails are not sending',
  pageUrl: 'https://app.zebri.com.au/payments',
  routePath: '/payments',
  browser: 'Chrome 141 on macOS',
  viewport: '1512 x 857',
  buildSha: 'a1b2c3d',
  account: 'marianna@example.com',
  ...over,
});

/** Pulls the plain text out of whatever block type this is. */
function textOf(block: Record<string, unknown>): string {
  const inner = block[block['type'] as string] as
    | { rich_text?: Array<{ text: { content: string } }> }
    | undefined;
  return inner?.rich_text?.map((r) => r.text.content).join('') ?? '';
}

describe('chunkText', () => {
  it('leaves a short string alone', () => {
    expect(chunkText('hello')).toEqual(['hello']);
  });

  it('never emits a run over the limit', () => {
    const long = 'word '.repeat(1000);
    for (const chunk of chunkText(long)) expect(chunk.length).toBeLessThanOrEqual(1900);
  });

  it('breaks on whitespace rather than mid-word', () => {
    const words = Array.from({ length: 600 }, (_, i) => `word${i}`);
    const chunks = chunkText(words.join(' '), 1900);
    expect(chunks.length).toBeGreaterThan(1);
    // Rejoining reproduces the exact word sequence only if no boundary fell
    // inside a word.
    expect(chunks.join(' ').split(' ')).toEqual(words);
  });

  it('hard-cuts a run with no whitespace to break on', () => {
    const blob = 'x'.repeat(4100);
    const chunks = chunkText(blob, 1900);
    expect(chunks).toHaveLength(3);
    expect(chunks.join('')).toBe(blob);
  });

  it('loses no content across a split', () => {
    const long = 'word '.repeat(900).trim();
    expect(chunkText(long).join(' ')).toBe(long);
  });
});

describe('buildTicketBlocks', () => {
  it('emits the file-concern headings in order', () => {
    const headings = buildTicketBlocks(body())
      .filter((b) => b['type'] === 'heading_2')
      .map(textOf);
    expect(headings).toEqual([
      'Concern (as raised)',
      'Summary',
      'Acceptance criteria',
      'Notes for the implementer',
    ]);
  });

  it("carries the MC's words through verbatim", () => {
    const blocks = buildTicketBlocks(body({ description: 'It just stops.' }));
    expect(blocks.map(textOf)).toContain('It just stops.');
  });

  it('splits a long description across several paragraphs', () => {
    const blocks = buildTicketBlocks(body({ description: 'word '.repeat(1200) }));
    const paragraphs = blocks.filter((b) => b['type'] === 'paragraph');
    expect(paragraphs.length).toBeGreaterThan(2);
  });

  it('records the captured context as bullets', () => {
    const bullets = buildTicketBlocks(body())
      .filter((b) => b['type'] === 'bulleted_list_item')
      .map(textOf);
    expect(bullets).toEqual([
      'Page: https://app.zebri.com.au/payments',
      'Route: /payments',
      'Browser: Chrome 141 on macOS',
      'Viewport: 1512 x 857',
      'Build: a1b2c3d',
      'Account: marianna@example.com',
    ]);
  });

  it('leaves an unchecked acceptance-criteria placeholder for triage', () => {
    const todo = buildTicketBlocks(body()).find((b) => b['type'] === 'to_do');
    expect((todo?.['to_do'] as { checked: boolean }).checked).toBe(false);
  });

  it('adds no image block when there is no screenshot', () => {
    expect(buildTicketBlocks(body()).some((b) => b['type'] === 'image')).toBe(false);
  });

  it('references the upload id when a screenshot was attached', () => {
    const blocks = buildTicketBlocks(
      body({ screenshot: { id: 'upload-9', filename: 'broken.png' } }),
    );
    const image = blocks.find((b) => b['type'] === 'image');
    expect(image?.['image']).toMatchObject({
      type: 'file_upload',
      file_upload: { id: 'upload-9' },
    });
  });

  it('stays within the 100-block create-page limit', () => {
    const blocks = buildTicketBlocks(body({ description: 'word '.repeat(50_000) }));
    expect(blocks.length).toBeLessThanOrEqual(100);
  });
});
