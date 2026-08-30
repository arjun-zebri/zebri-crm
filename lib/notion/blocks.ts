/**
 * Builds the page body of a Zebri ticket.
 *
 * The block sequence matches the template the `/file-concern` skill writes by
 * hand, so a ticket filed from the app is indistinguishable from one filed in
 * conversation and `/pick-ticket` can read either without special-casing.
 *
 * @module lib/notion/blocks
 */
import type { NotionBlock, NotionFileUploadRef, NotionRichText } from './types';

/**
 * Notion rejects any rich-text run longer than 2000 characters.
 *
 * We chunk at 1900 to leave room for the trailing whitespace a split can carry
 * and to stay clear of the boundary if Notion ever counts graphemes rather
 * than UTF-16 units.
 */
const MAX_RICH_TEXT = 1900;

/** Notion accepts at most 100 blocks in a single create-page call. */
const MAX_BLOCKS = 100;

/** Everything the ticket body renders. */
export interface TicketBody {
  /** The MC's own words, verbatim. */
  description: string;
  /** One-line restatement, shown under Summary. */
  summary: string;
  /** Where they were when they hit it. */
  pageUrl: string;
  routePath: string;
  /** Human-readable browser summary, e.g. "Chrome 141 on macOS". */
  browser: string;
  /** e.g. "1512 x 857". */
  viewport: string;
  /** Deploy the report came from, or 'unknown' locally. */
  buildSha: string;
  /**
   * Who filed it, as an email.
   *
   * Not the Supabase user id: a uuid means a database lookup before you can
   * even reply to the person, and the id is already on the `bug_reports` row
   * if it is ever needed.
   */
  account: string;
  /** Optional screenshot, already uploaded to Notion. */
  screenshot?: NotionFileUploadRef | undefined;
}

/** Wraps a string as a single-run rich-text array. */
function text(content: string): NotionRichText[] {
  return [{ type: 'text', text: { content } }];
}

/**
 * Splits a long string into runs Notion will accept.
 *
 * Breaks on the last newline or space inside the window so a paragraph does
 * not tear mid-word. Falls back to a hard cut when a chunk has no whitespace
 * at all, which is what a pasted stack trace or a base64 blob looks like.
 */
export function chunkText(content: string, limit = MAX_RICH_TEXT): string[] {
  if (content.length <= limit) return [content];

  const chunks: string[] = [];
  let rest = content;
  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    const breakAt = Math.max(window.lastIndexOf('\n'), window.lastIndexOf(' '));
    const cut = breakAt > limit / 2 ? breakAt : limit;
    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function heading(content: string): NotionBlock {
  return { type: 'heading_2', heading_2: { rich_text: text(content) } };
}

function paragraph(content: string): NotionBlock {
  return { type: 'paragraph', paragraph: { rich_text: text(content) } };
}

function bullet(content: string): NotionBlock {
  return { type: 'bulleted_list_item', bulleted_list_item: { rich_text: text(content) } };
}

/** Builds the full block list for a ticket page. */
export function buildTicketBlocks(body: TicketBody): NotionBlock[] {
  const blocks: NotionBlock[] = [
    heading('Concern (as raised)'),
    ...chunkText(body.description).map(paragraph),

    heading('Summary'),
    paragraph(body.summary),

    heading('Acceptance criteria'),
    { type: 'to_do', to_do: { rich_text: text('Define during triage'), checked: false } },

    heading('Notes for the implementer'),
    bullet(`Page: ${body.pageUrl}`),
    bullet(`Route: ${body.routePath}`),
    bullet(`Browser: ${body.browser}`),
    bullet(`Viewport: ${body.viewport}`),
    bullet(`Build: ${body.buildSha}`),
    bullet(`Account: ${body.account}`),
    paragraph('Submitted from the in-app Feedback pill.'),
  ];

  if (body.screenshot) {
    blocks.push({
      type: 'image',
      image: {
        type: 'file_upload',
        file_upload: { id: body.screenshot.id },
        caption: text(body.screenshot.filename),
      },
    });
  }

  // The template cannot reach 100 blocks on its own, but a 5000-character
  // description chunks into three or four paragraphs and the cap is cheap
  // insurance against a future template that forgets this limit exists.
  return blocks.slice(0, MAX_BLOCKS);
}
