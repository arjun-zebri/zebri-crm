/**
 * Their latest reply, quoted at the top of the prospect modal.
 *
 * A reply is the reason to open a prospect, so it should not be one line
 * deep in the timeline. Shows nothing when they have not replied. A reply
 * marked by hand (an Instagram DM, a phone call) has no text to quote, so
 * it says how it came in instead.
 *
 * @module features/outreach/views/prospects/latest-reply
 */
import { MessageSquare } from 'lucide-react';

import type { OutreachEvent } from '@/lib/outreach/types';

import { CHANNEL_LABELS, formatRelative, formatSydneyDateTime, humanize } from './labels';

/** Props for {@link LatestReply}. */
export interface LatestReplyProps {
  /** The prospect's events, newest first. */
  events: OutreachEvent[];
}

/** The reply's quoted text from the event payload, or null. */
function snippetOf(payload: unknown): string | null {
  const v = (payload as { snippet?: unknown } | null)?.snippet;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** The newest reply, quoted, with channel and time. */
export function LatestReply({ events }: LatestReplyProps) {
  const reply = events.find((e) => e.type === 'replied');
  if (!reply) return null;
  const channel = reply.channel ? (CHANNEL_LABELS[reply.channel] ?? humanize(reply.channel)) : null;
  const snippet = snippetOf(reply.payload);
  return (
    <section aria-label="Their latest reply" className="space-y-2 rounded-control border border-border bg-surface-muted p-4">
      <div className="flex flex-wrap items-center gap-2 text-body text-text-muted">
        <MessageSquare size={14} strokeWidth={1.5} aria-hidden="true" />
        <span className="font-medium text-text">They replied</span>
        {channel && <span>by {channel.toLowerCase()}</span>}
        <time dateTime={reply.occurred_at} title={formatSydneyDateTime(reply.occurred_at)} className="text-text-subtle">
          {formatRelative(reply.occurred_at)}
        </time>
      </div>
      {snippet ? (
        <blockquote className="whitespace-pre-wrap text-body text-text">“{snippet}”</blockquote>
      ) : (
        <p className="text-body text-text-muted">Marked as replied by you. There is no message text to show.</p>
      )}
    </section>
  );
}
