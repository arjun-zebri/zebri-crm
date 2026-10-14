'use client';

/**
 * One plain line at the top of Today saying whether email is going out,
 * and why not when it is blocked. Visible on phones: this is the answer
 * to "why is nothing sending?", so it is never hidden behind a breakpoint.
 *
 * @module features/outreach/views/today/send-status-line
 */
import { Clock } from 'lucide-react';

import type { SendStatus } from '@/lib/outreach/services/send-status';

/** Props for {@link SendStatusLine}. */
export interface SendStatusLineProps {
  status: SendStatus;
}

/**
 * Text for the line. Blocked reasons are the whole story, so they are
 * shown in full; the scheduler warning is appended when it applies.
 */
export function sendStatusText(status: SendStatus): string {
  return status.schedulerWarning ? `${status.headline} ${status.schedulerWarning}` : status.headline;
}

/** The header line: warning tone when blocked or the scheduler is stale. */
export function SendStatusLine({ status }: SendStatusLineProps) {
  const warn = status.blocked || status.schedulerWarning !== null;
  return (
    <p
      role="status"
      className={`flex items-start gap-2 text-body ${warn ? 'text-warning' : 'text-text-muted'}`}
    >
      <Clock className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
      <span className="min-w-0">
        {sendStatusText(status)} <span className="text-text-subtle">{status.sent} of {status.cap} emails today.</span>
      </span>
    </p>
  );
}
