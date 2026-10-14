/**
 * The Messages tab of the prospect modal: every email and DM queued or
 * sent for this person, newest first, one line each. "Read" opens the
 * full text in place. A one-line row says what it is (subject, or which
 * DM), where it stands, and when; anything more waits for "Read".
 *
 * @module features/outreach/views/prospects/drawer-messages
 */
import { Instagram, Mail } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { OPT_OUT_LINE } from '@/lib/outreach/render';
import type { ProspectDetail } from '@/lib/outreach/services/queries';

import { formatRelative, formatSydneyDateTime, humanize } from './labels';

type Message = ProspectDetail['messages'][number];

/** Where a message stands, in a few words, including when. */
function statusLine(m: Message): string {
  if (m.status === 'sent' && m.sent_at) return `Sent ${formatRelative(m.sent_at)}`;
  if (m.status === 'scheduled') return `Due ${formatSydneyDateTime(m.scheduled_for)}`;
  if (m.status === 'failed') return 'Failed to send';
  if (m.skip_reason === 'replied') return 'Not sent, they replied';
  if (m.skip_reason === 'bounced') return 'Not sent, an earlier email bounced';
  if (m.skip_reason === 'opted_out') return 'Not sent, they opted out';
  return humanize(m.status);
}

/** One message: a line, and the full text when opened. */
function MessageRow({ m, open, onToggle }: { m: Message; open: boolean; onToggle: () => void }) {
  const isEmail = m.channel === 'email';
  const Icon = isEmail ? Mail : Instagram;
  const title = isEmail ? (m.subject || 'Email') : 'Instagram DM';
  const muted = m.status !== 'sent';
  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <Icon size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-text-muted" />
        <div className="min-w-0 flex-1">
          <p className={`truncate text-body ${muted ? 'text-text-muted' : 'text-text'}`}>{title}</p>
          <p className={`text-body ${m.status === 'failed' ? 'text-danger' : 'text-text-subtle'}`}>{statusLine(m)}</p>
        </div>
        <Button variant="ghost" onClick={onToggle} aria-expanded={open}>
          {open ? 'Hide' : 'Read'}
        </Button>
      </div>
      {open && (
        <div className="mt-3 ml-7 space-y-2 rounded-control bg-surface-muted p-4">
          {m.error && <p className="text-body text-danger">{m.error}</p>}
          <p className="whitespace-pre-wrap text-body text-text">{m.body}</p>
          {/* Why: the footer is added at send time, so an unsent email's text stops at the message. */}
          {isEmail && !m.body.trimEnd().endsWith(OPT_OUT_LINE) && (
            <p className="text-body text-text-muted">Your signature and opt-out line are added when it sends.</p>
          )}
        </div>
      )}
    </li>
  );
}

/** Props for {@link MessagesSection}. */
export interface MessagesSectionProps {
  messages: ProspectDetail['messages'];
}

/** Every message for this person, newest first. */
export function MessagesSection({ messages }: MessagesSectionProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (messages.length === 0) return <p className="text-body text-text-muted">No messages yet.</p>;
  return (
    <ul className="divide-y divide-border">
      {messages.map((m) => (
        <MessageRow key={m.id} m={m} open={openIds.has(m.id)} onToggle={() => toggle(m.id)} />
      ))}
    </ul>
  );
}
