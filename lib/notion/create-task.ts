/**
 * Creates a ticket in the Notion Tasks Tracker database.
 *
 * Tasks Tracker is the single queue: `/file-concern` writes to it, and
 * `/pick-ticket` reads from it. Reports filed from the app land in the
 * "User submitted tickets" sprint at status Triage, which is what separates
 * them from tickets raised internally.
 *
 * @module lib/notion/create-task
 */
import type { BugReportType } from '@/types/bug-report';

import { buildTicketBlocks, type TicketBody } from './blocks';
import { notionFetch, notionTasksDataSourceId } from './client';
import type { NotionPageResponse, NotionPropertyValues, NotionRichText } from './types';

/** Sprint that groups everything submitted through the in-app Feedback pill. */
export const USER_SUBMITTED_SPRINT = 'User submitted tickets';

/** Status new reports land on, so they read as untriaged in the board. */
const TRIAGE_STATUS = 'Triage';

/**
 * The `Description` property is a table-view column, not the ticket body.
 * It carries a preview so the board is scannable; the full text lives in the
 * page body under "Concern (as raised)".
 */
const DESCRIPTION_PREVIEW_CHARS = 200;

/** Everything needed to file one ticket. */
export interface CreateTicketInput {
  /** Becomes the `Task name` title. */
  title: string;
  type: BugReportType;
  /** "Marianna (marianna@example.com)". */
  reporter: string;
  /** Page body content. */
  body: TicketBody;
}

/** What a filed ticket gives back. */
export interface CreatedTicket {
  pageId: string;
  pageUrl: string;
  /** e.g. "ZEB-42". Null when the Ticket ID property is missing from Notion. */
  ticketRef: string | null;
}

function richText(content: string): NotionRichText[] {
  return [{ type: 'text', text: { content } }];
}

/** Trims the body down to a one-line preview for the table view. */
function descriptionPreview(description: string): string {
  const flat = description.replace(/\s+/g, ' ').trim();
  return flat.length <= DESCRIPTION_PREVIEW_CHARS
    ? flat
    : `${flat.slice(0, DESCRIPTION_PREVIEW_CHARS - 1).trimEnd()}…`;
}

/**
 * Pulls "ZEB-42" out of a created page's `Ticket ID` property.
 *
 * Returns null rather than throwing: a ticket that exists but whose reference
 * we could not read is still a success, it just means the MC gets the plain
 * thank-you instead of a number.
 */
export function readTicketRef(properties: Record<string, unknown>): string | null {
  const prop = properties['Ticket ID'];
  if (!prop || typeof prop !== 'object') return null;
  const uniqueId = (prop as { unique_id?: { prefix?: string | null; number?: number } }).unique_id;
  if (!uniqueId || typeof uniqueId.number !== 'number') return null;
  return uniqueId.prefix ? `${uniqueId.prefix}-${uniqueId.number}` : String(uniqueId.number);
}

/**
 * Files a ticket and returns its id, URL and human reference.
 *
 * @throws {import('./client').NotionApiError} on any Notion failure.
 */
export async function createTask(input: CreateTicketInput): Promise<CreatedTicket> {
  // `Status` is a Notion *status* property, not a select, so the payload key
  // is `status`. Sending `select` here is accepted as valid JSON and rejected
  // by Notion with a validation error that names the wrong field.
  const properties: NotionPropertyValues = {
    'Task name': { title: richText(input.title) },
    Description: { rich_text: richText(descriptionPreview(input.body.description)) },
    Status: { status: { name: TRIAGE_STATUS } },
    Priority: { select: { name: 'Medium' } },
    Sprint: { select: { name: USER_SUBMITTED_SPRINT } },
    Type: { select: { name: input.type } },
    Repo: { select: { name: 'zebri-app' } },
    Reporter: { rich_text: richText(input.reporter) },
    // Area and Slug stay blank on purpose. Both drive triage decisions
    // (Slug becomes the branch name), and a wrong guess is worse than a gap.
  };

  const page = await notionFetch<NotionPageResponse>('/pages', {
    parent: { type: 'data_source_id', data_source_id: notionTasksDataSourceId() },
    properties,
    children: buildTicketBlocks(input.body),
  });

  return {
    pageId: page.id,
    pageUrl: page.url,
    ticketRef: readTicketRef(page.properties),
  };
}
