import type { PublicBranding } from "@/lib/branding/public-branding";
import { OTP_TTL_SECONDS } from "@/lib/contracts/otp";

import { dispatchEmail, type DispatchResult, type EmailAttachment } from "./dispatch";
import {
  contractHtml,
  contractOtpHtml,
  contractReminderHtml,
  contractSignedHtml,
  invoiceHtml,
  type LeadNotificationOpts,
  leadNotificationHtml,
  questionnaireHtml,
  type SignerLink,
} from "./html";
import { DEFAULT_FROM, type ResolvedSender } from "./sender-identity";

export type { EmailAttachment } from "./dispatch";
export type { SignerLink } from "./html";
// Re-export the pure HTML builders so existing server callers keep importing
// them from `@/lib/email`. Client code (e.g. the email preview) must import
// them from `@/lib/email/html` directly to avoid bundling the transport
// layer (Resend + nodemailer) into the browser.
export {
  bookingCancelledHtml,
  bookingChangeNotificationHtml,
  bookingConfirmationHtml,
  bookingNotificationHtml,
  bookingRescheduledHtml,
  contractHtml,
  invoiceHtml,
  leadNotificationHtml,
  questionnaireHtml,
  wrapTemplateHtml,
} from "./html";

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
  /**
   * Every signer who shares this address, each with their own link. Partners
   * often share one inbox, and each holds a distinct capability token, so one
   * email has to carry both named links. Omit for a single signer, which keeps
   * `shareUrl` as the only CTA.
   */
  links?: SignerLink[];
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

/**
 * Email a signer their one-time verification code.
 *
 * The code is in the body only; the subject deliberately carries just the
 * contract number, so it does not appear in a lock-screen preview.
 */
export async function sendContractOtpEmail(opts: {
  recipientEmail: string;
  recipientName: string;
  code: string;
  contractNumber: string;
  mcBusinessName: string;
  sender?: ResolvedSender;
  branding?: PublicBranding | null;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await dispatchEmail(opts.sender ?? DEFAULT_SENDER, {
    to: opts.recipientEmail,
    subject: `Your code to sign ${opts.contractNumber}`,
    html: contractOtpHtml({ ...opts, minutes: Math.round(OTP_TTL_SECONDS / 60) }, opts.branding),
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error ?? 'Send failed' };
}

export async function sendContractReminderEmail(opts: {
  coupleEmail: string;
  coupleName: string;
  contractNumber: string;
  contractTitle: string;
  expiresAt: string | null;
  shareUrl: string;
  mcBusinessName: string;
  /** Every outstanding signer at this address. See {@link sendContractEmail}. */
  links?: SignerLink[];
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

/**
 * Deliver the executed contract to one party once every required signature is
 * in. Called for each signer and for the account holder.
 */
export async function sendContractSignedEmail(opts: {
  recipientEmail: string;
  recipientName: string;
  contractNumber: string;
  contractTitle: string;
  signerNames: string[];
  signedAt: string | null;
  shareUrl: string;
  mcBusinessName: string;
  /** Resolved transport. Defaults to the shared Zebri address (Resend). */
  sender?: ResolvedSender;
  /** Optional sender's branding for branded emails. */
  branding?: PublicBranding | null;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await dispatchEmail(opts.sender ?? DEFAULT_SENDER, {
    to: opts.recipientEmail,
    subject: `Signed: ${opts.contractTitle} - ${opts.contractNumber}`,
    html: contractSignedHtml(opts, opts.branding),
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

// Re-export the booking email senders.
export {
  sendBookingCancelledEmail,
  sendBookingChangeNotificationEmail,
  sendBookingConfirmationEmail,
  sendBookingNotificationEmail,
  sendBookingRescheduledEmail,
} from "./booking";
