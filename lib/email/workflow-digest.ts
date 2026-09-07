/**
 * The morning digest email.
 *
 * Sent to the MC themselves, not to a couple, so it deliberately skips
 * the branded couple-facing shell: this is an internal note, and dressing
 * it up as client correspondence makes it harder to scan at 7am.
 *
 * @module lib/email/workflow-digest
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { DigestPayload } from '@/lib/workflows/digest';
import type { QueueItem } from '@/lib/workflows/queue';
import type { Database } from '@/types/database';

import { dispatchEmail, type DispatchResult } from './dispatch';
import { resolveSender } from './sender-identity';

/** Escape text for interpolation into the digest markup. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** "Sam and Alex" or, for a personal to-do, the honest alternative. */
function who(item: QueueItem): string {
  return item.coupleName ?? 'Just for you';
}

/** One list item: the step, then who it is for. */
function line(item: QueueItem): string {
  return `<li style="margin:0 0 6px;font-size:14px;color:#111827;">${esc(item.title)}<span style="color:#6b7280;"> &middot; ${esc(who(item))}</span></li>`;
}

/** A titled block, or nothing at all when the group is empty. */
function section(title: string, colour: string, items: QueueItem[]): string {
  if (items.length === 0) return '';
  return `
    <p style="margin:24px 0 8px;font-size:13px;font-weight:600;color:${colour};text-transform:uppercase;letter-spacing:0.04em;">${esc(title)}</p>
    <ul style="margin:0;padding-left:18px;">${items.map(line).join('')}</ul>`;
}

/** Render the digest body. Exported so the tests can read it. */
export function workflowDigestHtml(
  payload: DigestPayload,
  appUrl: string,
): string {
  const { weekday, dayMonth } = friendlyDate(payload.localDate);
  const cta = `${appUrl.replace(/\/$/, '')}/workflows`;

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
    <p style="margin:0;font-size:13px;color:#6b7280;">${esc(weekday)} ${esc(dayMonth)}</p>
    <h1 style="margin:4px 0 0;font-size:20px;font-weight:600;color:#111827;">Your day</h1>

    ${section('Needs your OK before it sends', '#b45309', payload.review)}
    ${section('Overdue', '#b91c1c', payload.overdue)}
    ${section('Due today', '#111827', payload.today)}
    ${section('Sending by itself today', '#6b7280', payload.sendingToday)}

    <table cellpadding="0" cellspacing="0" style="margin-top:28px;">
      <tr><td style="background:#111827;border-radius:8px;">
        <a href="${esc(cta)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Open your day</a>
      </td></tr>
    </table>

    <p style="margin:28px 0 0;font-size:12px;color:#9ca3af;">
      You get this only on days there is something to see. Turn it off in Settings.
    </p>
  </div>
</body></html>`;
}

/** Split a `YYYY-MM-DD` into the parts the header prints. */
function friendlyDate(localDate: string): { weekday: string; dayMonth: string } {
  // Midday avoids any chance of the label naming the day either side.
  const at = new Date(`${localDate}T12:00:00Z`);
  return {
    weekday: at.toLocaleDateString('en-AU', { weekday: 'long', timeZone: 'UTC' }),
    dayMonth: at.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }),
  };
}

/**
 * Send one MC their digest.
 *
 * @param supabase - service-role client; a cron run has no session
 * @param to - the MC's own email address
 */
export async function sendWorkflowDigestEmail(
  supabase: SupabaseClient<Database>,
  opts: {
    payload: DigestPayload;
    to: string;
    businessName: string;
    subject: string;
    appUrl: string;
  },
): Promise<DispatchResult> {
  const sender = await resolveSender(supabase, opts.payload.userId, opts.businessName);
  return dispatchEmail(sender, {
    to: opts.to,
    subject: opts.subject,
    html: workflowDigestHtml(opts.payload, opts.appUrl),
  });
}
