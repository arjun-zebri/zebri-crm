/**
 * Domain types for in-app feedback.
 *
 * The kinds live here rather than in `lib/notion` because they are a product
 * decision (what an MC can tell us) that happens to map onto a Notion select,
 * not the other way round. Keeping one list means the form, the API schema and
 * the Notion payload cannot drift apart.
 *
 * @module types/bug-report
 */
import type { Database } from '@/types/database';

/** A stored report, exactly as the table holds it. */
export type BugReportRow = Database['public']['Tables']['bug_reports']['Row'];

/** How the Notion push went. */
export type BugReportSyncStatus = 'pending' | 'synced' | 'failed';

/** The kinds of feedback an MC can send. Mirrors the Notion `Type` select. */
export const BUG_REPORT_TYPES = ['Bug', 'Feature', 'Improvement'] as const;

/** One of {@link BUG_REPORT_TYPES}. */
export type BugReportType = (typeof BUG_REPORT_TYPES)[number];
