import type { PublicBranding } from "@/lib/branding/public-branding";

import { dispatchEmail, type DispatchResult, type EmailAttachment } from "./dispatch";
import {
  contractHtml,
  contractReminderHtml,
  invoiceHtml,
  type LeadNotificationOpts,
  leadNotificationHtml,
  proposalHtml,
  questionnaireHtml,
} from "./html";
import { DEFAULT_FROM, type ResolvedSender } from "./sender-identity";

export type { EmailAttachment } from "./dispatch";
// Re-export the pure HTML builders so existing server callers keep importing
// them from `@/lib/email`. Client code (e.g. the email preview) must import
// them from `@/lib/email/html` directly to avoid bundling the transport
// layer (Resend + nodemailer) into the browser.
export { contractHtml, invoiceHtml, leadNotificationHtml, proposalHtml, questionnaireHtml, wrapTemplateHtml } from "./html";

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

/**
 * Notify the MC that a website lead-capture form was submitted. Sent from the
 * shared Zebri address; reply-to is set to the couple so the MC can respond
 * straight to the lead.
 */
export async function sendLeadNotificationEmail(opts: {
  to: string;
  mcBusinessName: string;
  lead: LeadNotificationOpts["lead"];
  replyTo?: string;
}): Promise<DispatchResult> {
  return dispatchEmail(DEFAULT_SENDER, {
    to: opts.to,
    subject: `New enquiry from ${opts.lead.name}`,
    html: leadNotificationHtml({ mcBusinessName: opts.mcBusinessName, lead: opts.lead }),
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
  });
}

export async function sendProposalEmail(opts: {
  coupleEmail: string;
  coupleName: string;
  proposalNumber: string;
  proposalTitle: string;
  shareUrl: string;
  mcBusinessName: string;
  /** Drives the email copy: >1 invites choosing between options. */
  optionCount: number;
  /** Resolved transport. Defaults to the shared Zebri address (Resend). */
  sender?: ResolvedSender;
  /** Optional sender's branding for branded emails. */
  branding?: PublicBranding | null;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await dispatchEmail(opts.sender ?? DEFAULT_SENDER, {
    to: opts.coupleEmail,
    subject: `Proposal from ${opts.mcBusinessName} - ${opts.proposalNumber}`,
    html: proposalHtml(opts, opts.branding),
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error ?? "Send failed" };
}

export async function sendQuestionnaireEmail(opts: {
  coupleEmail: string;
  coupleName: string;
  title: string;
  shareUrl: string;
  mcBusinessName: string;
  /** Resolved transport. Defaults to the shared Zebri address (Resend). */
  sender?: ResolvedSender;
  /** Optional sender's branding for branded emails. */
  branding?: PublicBranding | null;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await dispatchEmail(opts.sender ?? DEFAULT_SENDER, {
    to: opts.coupleEmail,
    subject: `${opts.mcBusinessName} sent you a few questions`,
    html: questionnaireHtml(opts, opts.branding),
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
  /** Optional sender's branding for branded emails. */
  branding?: PublicBranding | null;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await dispatchEmail(opts.sender ?? DEFAULT_SENDER, {
    to: opts.coupleEmail,
    subject: `Contract from ${opts.mcBusinessName} - ${opts.contractNumber}`,
    html: contractHtml(opts, opts.branding),
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
  /** Optional sender's branding for branded emails. */
  branding?: PublicBranding | null;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await dispatchEmail(opts.sender ?? DEFAULT_SENDER, {
    to: opts.coupleEmail,
    subject: `Reminder: please sign your contract - ${opts.contractNumber}`,
    html: contractReminderHtml(opts, opts.branding),
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
  /** Optional sender's branding for branded emails. */
  branding?: PublicBranding | null;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await dispatchEmail(opts.sender ?? DEFAULT_SENDER, {
    to: opts.coupleEmail,
    subject: `Invoice from ${opts.mcBusinessName} - ${opts.invoiceNumber}`,
    html: invoiceHtml(opts, opts.branding),
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error ?? "Send failed" };
}
