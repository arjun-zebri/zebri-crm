import { GMAIL_CLIP_KB, type EmailTemplate } from '../email-data';

/**
 * How each inbox bends an email, so the preview shows what a couple
 * really sees rather than what the builder drew. These are the handful
 * of differences that change how an MC's email looks, not a full
 * rendering engine: which inboxes load web fonts (the brand's heading
 * font), Outlook for Windows squaring rounded buttons (it draws email
 * with Word), Gmail clipping long emails, and phones leaving out blocks
 * marked "Hide on phone". Each comes with a plain line for the checks
 * list beside the preview.
 *
 * @module app/design-system/v2/pages/dashboard/email/render/quirks
 */

export type Client = 'gmail' | 'outlook' | 'apple' | 'yahoo' | 'web';
export type Device = 'desktop' | 'tablet' | 'phone';

export const CLIENTS: { value: Client; label: string }[] = [
  { value: 'gmail', label: 'Gmail' },
  { value: 'outlook', label: 'Outlook' },
  { value: 'apple', label: 'Apple Mail' },
  { value: 'yahoo', label: 'Yahoo Mail' },
  { value: 'web', label: 'Web version' },
];

export const DEVICES: { value: Device; label: string }[] = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'tablet', label: 'iPad' },
  { value: 'phone', label: 'Phone' },
];

export const clientName = (c: Client) => CLIENTS.find((x) => x.value === c)!.label;

/** What an inbox does to the email. */
export interface Quirks {
  /** Loads the brand's web fonts; otherwise the heading falls back to Georgia and the body to Arial. */
  webFonts: boolean;
  /** Draws rounded corners square. */
  squareCorners: boolean;
  /** Cuts the email off behind "View entire message". */
  clipped: boolean;
  /** Narrow screen: stacked columns, "Hide on phone" blocks left out. */
  narrow: boolean;
}

/** One line in the checks list: fine, or worth knowing. */
export interface Check {
  ok: boolean;
  text: string;
}

/** What `client` on `device` does to a template's email. The web version ignores the device. */
export function quirksOf(client: Client, device: Device, kb: number): Quirks {
  const d = client === 'web' ? 'desktop' : device;
  return {
    webFonts: client === 'apple' || client === 'web',
    squareCorners: client === 'outlook' && d === 'desktop',
    clipped: client === 'gmail' && kb > GMAIL_CLIP_KB,
    narrow: d === 'phone',
  };
}

/** The checks for a template in one inbox, problems first. */
export function checksFor(t: Pick<EmailTemplate, 'kb' | 'blocks'>, client: Client, device: Device): Check[] {
  const q = quirksOf(client, device, t.kb);
  const hidden = t.blocks.filter((b) => b.hideOnPhone).length;
  const checks: Check[] = [
    q.clipped
      ? { ok: false, text: `Gmail clips it: ${t.kb}KB is over its ${GMAIL_CLIP_KB}KB limit, so the end, your signature and the unsubscribe link sit behind "View entire message". Fewer images fixes it.` }
      : { ok: true, text: `${t.kb}KB, under Gmail's ${GMAIL_CLIP_KB}KB clipping limit` },
    q.webFonts
      ? { ok: true, text: 'Your heading font loads' }
      : { ok: false, text: 'Your heading font does not load here, so headings show in Georgia. Still reads well.' },
    q.squareCorners
      ? { ok: false, text: 'Outlook for Windows draws buttons with square corners.' }
      : { ok: true, text: 'Buttons keep their rounded corners' },
  ];
  if (hidden) {
    checks.push(
      q.narrow
        ? { ok: true, text: `${hidden === 1 ? '1 block is' : `${hidden} blocks are`} hidden on phones, as you set` }
        : { ok: true, text: `${hidden === 1 ? '1 block hides' : `${hidden} blocks hide`} on phones` },
    );
  }
  return checks.sort((a, b) => Number(a.ok) - Number(b.ok));
}
