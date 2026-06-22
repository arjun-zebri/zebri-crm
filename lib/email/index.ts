import { dispatchEmail, type DispatchResult, type EmailAttachment } from "./dispatch";
import {
  contractHtml,
  contractReminderHtml,
  invoiceHtml,
  quoteHtml,
} from "./html";
import { DEFAULT_FROM, type ResolvedSender } from "./sender-identity";

export type { EmailAttachment } from "./dispatch";
// Re-export the pure HTML builders so existing server callers keep importing
// them from `@/lib/email`. Client code (e.g. the email preview) must import
// them from `@/lib/email/html` directly to avoid bundling the transport
// layer (Resend + nodemailer) into the browser.
export { contractHtml, invoiceHtml, quoteHtml, wrapTemplateHtml } from "./html";

/**
 * Default transport for couple-facing mail: Resend, from the shared Zebri
 * address. Senders below accept an optional `sender` (resolved per-MC via
 * {@link resolveSender} — a verified SMTP mailbox or this default); when
 * absent they fall back to this.
 */
const DEFAULT_SENDER: ResolvedSender = { transport: "resend", from: DEFAULT_FROM };

/**
 * Send a fully-rendered template email (subject + HTML body already
 * resolved). The single send path for the manual compose flow and the
 * automation template handler.
 */
export async function sendTemplateEmail(opts: {
  to: string;
  subject: string;
  html: string;
  /** Resolved transport. Defaults to the shared Zebri address (Resend). */
  sender?: ResolvedSender;
  replyTo?: string;
  bcc?: string;
  attachments?: EmailAttachment[];
}): Promise<DispatchResult> {
  return dispatchEmail(opts.sender ?? DEFAULT_SENDER, {
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    ...(opts.bcc ? { bcc: opts.bcc } : {}),
    ...(opts.attachments ? { attachments: opts.attachments } : {}),
  });
}

export async function sendQuoteEmail(opts: {
  coupleEmail: string;
  coupleName: string;
  quoteNumber: string;
  quoteTitle: string;
  shareUrl: string;
  mcBusinessName: string;
  /** Resolved transport. Defaults to the shared Zebri address (Resend). */
  sender?: ResolvedSender;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await dispatchEmail(opts.sender ?? DEFAULT_SENDER, {
    to: opts.coupleEmail,
    subject: `Quote from ${opts.mcBusinessName} - ${opts.quoteNumber}`,
    html: quoteHtml(opts),
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error ?? "Send failed" };
}

export async function sendContractEmail(opts: {
  coupleEmail: string;
  coupleName: string;
  contractNumber: string;
  contractTitle: string;
  expiresAt: string | null;
  shareUrl: string;
  mcBusinessName: string;
  /** Resolved transport. Defaults to the shared Zebri address (Resend). */
  sender?: ResolvedSender;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await dispatchEmail(opts.sender ?? DEFAULT_SENDER, {
    to: opts.coupleEmail,
    subject: `Contract from ${opts.mcBusinessName} - ${opts.contractNumber}`,
    html: contractHtml(opts),
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error ?? "Send failed" };
}

export async function sendContractReminderEmail(opts: {
  coupleEmail: string;
  coupleName: string;
  contractNumber: string;
  contractTitle: string;
  expiresAt: string | null;
  shareUrl: string;
  mcBusinessName: string;
  /** Resolved transport. Defaults to the shared Zebri address (Resend). */
  sender?: ResolvedSender;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await dispatchEmail(opts.sender ?? DEFAULT_SENDER, {
    to: opts.coupleEmail,
    subject: `Reminder: please sign your contract - ${opts.contractNumber}`,
    html: contractReminderHtml(opts),
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error ?? "Send failed" };
}

export async function sendInvoiceEmail(opts: {
  coupleEmail: string;
  coupleName: string;
  invoiceNumber: string;
  invoiceTitle: string;
  dueDate: string | null;
  shareUrl: string;
  mcBusinessName: string;
  /** Resolved transport. Defaults to the shared Zebri address (Resend). */
  sender?: ResolvedSender;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await dispatchEmail(opts.sender ?? DEFAULT_SENDER, {
    to: opts.coupleEmail,
    subject: `Invoice from ${opts.mcBusinessName} - ${opts.invoiceNumber}`,
    html: invoiceHtml(opts),
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error ?? "Send failed" };
}
