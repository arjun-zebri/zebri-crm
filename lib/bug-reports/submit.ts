/**
 * Pushes a saved bug report to Notion and records how it went.
 *
 * Called after the `bug_reports` row already exists, so every failure path
 * here is recoverable: the report is on disk, and the Slack alert carries the
 * full text for re-filing. Nothing in this module is allowed to throw, because
 * a Notion outage must not turn into a failed submission for the MC.
 *
 * @module lib/bug-reports/submit
 */
import { sendAlert } from '@/lib/alerts/send-alert';
import { NotionApiError } from '@/lib/notion/client';
import { createTask } from '@/lib/notion/create-task';
import { uploadScreenshot } from '@/lib/notion/file-upload';
import type { NotionFileUploadRef } from '@/lib/notion/types';
import type { createClient } from '@/lib/supabase/server';
import type { BugReportType } from '@/types/bug-report';

/** Supabase client the caller already built for this request. */
type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Everything the Notion ticket needs, gathered by the route. */
export interface BugReportContext {
  /** `bug_reports.id`, the durable copy. */
  reportId: string;
  title: string;
  description: string;
  reportType: BugReportType;
  /** "Marianna (marianna@example.com)". */
  reporter: string;
  pageUrl: string;
  routePath: string;
  /** Human-readable, e.g. "Chrome 141 on macOS". */
  browser: string;
  /** e.g. "1512 x 857". */
  viewport: string;
  buildSha: string;
  /** The reporter's email, shown in the ticket body. */
  account: string;
}

/** What the route tells the MC. Both null when Notion refused the ticket. */
export interface SyncResult {
  ticketRef: string | null;
  notionUrl: string | null;
}

function reasonOf(err: unknown): string {
  if (err instanceof NotionApiError) return `${err.code} (${err.status}): ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}

/**
 * Uploads the screenshot, tolerating failure.
 *
 * A ticket without its screenshot is still a useful ticket, so an upload that
 * fails alerts and returns undefined rather than sinking the whole report.
 */
async function uploadOrSkip(
  screenshot: File | null,
  reportId: string,
): Promise<NotionFileUploadRef | undefined> {
  if (!screenshot) return undefined;
  try {
    return await uploadScreenshot(screenshot);
  } catch (err) {
    await sendAlert({
      type: 'bug_report_screenshot_upload_failed',
      severity: 'warn',
      reportId,
      reason: reasonOf(err),
    });
    return undefined;
  }
}

/**
 * Files the Notion ticket and updates the report row with the outcome.
 *
 * @returns The ticket reference and URL, or nulls when Notion refused it.
 */
export async function syncReportToNotion(
  supabase: ServerClient,
  ctx: BugReportContext,
  screenshot: File | null,
): Promise<SyncResult> {
  const uploaded = await uploadOrSkip(screenshot, ctx.reportId);

  try {
    const ticket = await createTask({
      title: ctx.title,
      type: ctx.reportType,
      reporter: ctx.reporter,
      body: {
        description: ctx.description,
        summary: ctx.title,
        pageUrl: ctx.pageUrl,
        routePath: ctx.routePath,
        browser: ctx.browser,
        viewport: ctx.viewport,
        buildSha: ctx.buildSha,
        account: ctx.account,
        screenshot: uploaded,
      },
    });

    await supabase
      .from('bug_reports')
      .update({
        notion_page_id: ticket.pageId,
        notion_page_url: ticket.pageUrl,
        notion_ticket_ref: ticket.ticketRef,
        notion_sync_status: 'synced',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ctx.reportId);

    await sendAlert({
      type: 'bug_report_submitted',
      severity: 'info',
      ticketRef: ticket.ticketRef,
      title: ctx.title,
      reportType: ctx.reportType,
      reporter: ctx.reporter,
      routePath: ctx.routePath,
      notionUrl: ticket.pageUrl,
    });

    return { ticketRef: ticket.ticketRef, notionUrl: ticket.pageUrl };
  } catch (err) {
    const reason = reasonOf(err);

    await supabase
      .from('bug_reports')
      .update({
        notion_sync_status: 'failed',
        notion_sync_error: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ctx.reportId);

    await sendAlert({
      type: 'bug_report_notion_sync_failed',
      severity: 'error',
      reportId: ctx.reportId,
      title: ctx.title,
      description: ctx.description,
      reporter: ctx.reporter,
      reason,
    });

    return { ticketRef: null, notionUrl: null };
  }
}
