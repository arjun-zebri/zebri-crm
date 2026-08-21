/**
 * Pure HTML builders for couple-facing emails (invoice / contract
 * / reminder) plus the branded shell wrapper.
 *
 * These are plain string functions with **no server-only dependencies**,
 * so they're safe to import from client components (e.g. the in-app email
 * preview). The actual senders live in `lib/email/index.ts`, which pulls
 * in the transport layer (Resend + nodemailer) and must stay server-only —
 * keeping the builders here avoids dragging nodemailer into the browser
 * bundle.
 *
 * @module lib/email/html
 */

import { FONT_STACKS, googleFontsHref } from "@/lib/branding/fonts";
import type { PublicBranding } from "@/lib/branding/public-branding";

/**
 * The plain-text automation email shell.
 *
 * Used by every automation step that sends a message the MC typed as
 * plain text (portal link, run sheet, the pre-composed sends without
 * a rich body). The body is escaped and its newlines become `<br>`,
 * so what the MC typed is what arrives and nothing they type can
 * inject markup.
 *
 * Pass `cta` when the email carries a link: it renders the button and
 * the copyable address beneath it that every other couple-facing
 * email uses, instead of leaving a bare URL in the text for the
 * recipient to find.
 *
 * Takes a business name rather than a run context so the in-app
 * preview can call it: the context type drags the automation runner
 * in, and this module has to stay importable from a client
 * component. `wrapAutomationHtml` in the messaging actions is the
 * context-taking wrapper the handlers use.
 */
export function wrapAutomationShell(
  body: string,
  businessName: string,
  cta?: { label: string; url: string } | undefined,
): string {
  const safe = escapeHtmlText(body).replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/\n/g, "<br>");
  // A bare URL in the body is a link the recipient has to notice and
  // select. Every other couple-facing email in the app gives it a
  // button with the address underneath for the clients that strip
  // them, and this matches that markup.
  const url = safeUrl(cta?.url);
  const action = cta && url
    ? `
          <table cellpadding="0" cellspacing="0" style="margin-top:32px;">
            <tr><td style="background:#111827;border-radius:8px;">
              <a href="${url}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtmlText(cta.label)}</a>
            </td></tr>
          </table>
          <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;">
            Or copy this link: <a href="${url}" style="color:#6b7280;">${escapeHtmlText(cta.url)}</a>
          </p>`
    : "";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="padding:40px;font-size:15px;color:#374151;line-height:1.6;">${safe}${action}</td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Sent by ${escapeHtmlText(businessName)} via Zebri</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A colour is only trusted into inline CSS when it's a plain hex value. */
function safeColor(value: string | null | undefined, fallback: string): string {
  return value && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : fallback;
}

/** Only http(s) URLs may become the logo `src`; quotes are encoded. */
function safeUrl(value: string | null | undefined): string | null {
  if (!value || !/^https?:\/\//i.test(value)) return null;
  return value.replace(/"/g, "%22");
}

/**
 * Wrap an already-rendered (HTML) email body in the outgoing shell.
 * Unlike the automation `wrapAutomationHtml` (which escapes a
 * plain-text body), this embeds trusted, sanitised HTML produced by
 * `renderEmailTemplate`.
 *
 * With `branding` (the MC's resolved {@link PublicBranding}) the shell
 * is fully branded: logo header (business name when no logo), brand
 * colour accents + links, the MC's heading/body fonts (Google Fonts
 * `<link>`; clients that strip web fonts fall back to each stack's
 * safe font), and their corner radius. Without it, the neutral Zebri
 * shell renders — identical to the pre-branding output.
 *
 * The same function feeds the editor's WYSIWYG preview iframe and the
 * send route, so the preview is exactly what lands in the inbox.
 */
export function wrapTemplateHtml(
  bodyHtml: string,
  mcBusinessName: string,
  branding?: PublicBranding | null,
): string {
  const safeName = escapeHtmlText(mcBusinessName);

  const brand = safeColor(branding?.brand_color, "#111827");
  // Font stacks use single-quoted family names: FONT_STACKS values carry
  // double quotes, which TERMINATE the style="…" attribute they're
  // interpolated into. Browsers recover from the malformed markup (so the
  // preview looked fine) but Gmail drops the whole broken style attribute
  // — padding included.
  const attrQuote = (stack: string) => stack.replace(/"/g, "'");
  const headingStack = branding ? attrQuote(FONT_STACKS[branding.font_heading]) : "inherit";
  const bodyStack = branding
    ? attrQuote(FONT_STACKS[branding.font_body])
    : "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
  const headingWeight = branding?.font_weight ?? 600;
  const bodyWeight = branding?.font_body_weight ?? 400;
  // Clamp so corrupted metadata can't produce a silly card shape.
  const radius = Math.min(Math.max(branding?.corner_radius ?? 12, 0), 32);
  const fontsHref = branding ? googleFontsHref([branding.font_heading, branding.font_body]) : null;
  const logoUrl = safeUrl(branding?.logo_url);

  // Header: the MC's logo, else their business name as a wordmark —
  // only when branding is on (the neutral shell stays headerless) and
  // the MC hasn't turned the header off in their email appearance.
  const align = branding?.email_logo_align === "center" ? "center" : "left";
  const logoImgAlign = align === "center" ? "margin:0 auto;" : "";
  const header =
    !branding || !branding.email_show_logo
      ? ""
      : logoUrl
        ? `<tr><td align="${align}" style="padding:32px 40px 0;"><img src="${logoUrl}" alt="${safeName}" height="44" style="display:block;${logoImgAlign}max-height:44px;width:auto;max-width:260px;"></td></tr>`
        : `<tr><td align="${align}" style="padding:32px 40px 0;font-family:${headingStack};font-size:18px;font-weight:${headingWeight};color:#111827;text-align:${align};">${safeName}</td></tr>`;

  // Brand accent bar across the top of the card (also switchable).
  const accentBar =
    branding && branding.email_show_accent
      ? `<tr><td style="height:4px;background:${brand};font-size:0;line-height:0;">&nbsp;</td></tr>`
      : "";

  // <style> in head: heading + link styling for the body content. Most
  // modern clients (Gmail included) honour head styles; the inline
  // fallbacks on the wrapper keep degraded clients readable.
  const headStyles = `<style>
    .zb-body h1{font-family:${headingStack};font-size:22px;font-weight:${headingWeight};line-height:1.3;color:#111827;margin:20px 0 8px;}
    .zb-body h2{font-family:${headingStack};font-size:18px;font-weight:${headingWeight};line-height:1.4;color:#111827;margin:18px 0 6px;}
    .zb-body h1:first-child,.zb-body h2:first-child{margin-top:0;}
    .zb-body a{color:${brand};}
    .zb-body ul,.zb-body ol{margin:8px 0;padding-left:22px;}
    .zb-body p{margin:8px 0;}
  </style>`;

  const fontsLink = fontsHref ? `<link rel="stylesheet" href="${fontsHref}">` : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${fontsLink}${headStyles}</head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:${bodyStack};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:${radius}px;border:1px solid #e5e7eb;overflow:hidden;">
        ${accentBar}${header}
        <tr><td class="zb-body" style="padding:32px 40px 40px;font-family:${bodyStack};font-weight:${bodyWeight};font-size:15px;color:#374151;line-height:1.6;">${bodyHtml}</td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Sent by ${safeName} via Zebri</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function questionnaireHtml(
  opts: {
    coupleName: string;
    title: string;
    shareUrl: string;
    mcBusinessName: string;
  },
  branding?: PublicBranding | null,
): string {
  const { coupleName, title, shareUrl, mcBusinessName } = opts;

  // When branding is provided, use the branded email wrapper; otherwise,
  // preserve the current hardcoded HTML for byte-for-byte compatibility.
  if (branding) {
    const bodyHtml = `<p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">A few questions</p>
          <h1 style="margin:0 0 24px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${title}</h1>
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${coupleName},<br><br>
            ${mcBusinessName} would love a few details to help plan your day. It only takes a couple of minutes, and you can come back to it any time.
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#111827;border-radius:8px;">
              <a href="${shareUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Start questionnaire</a>
            </td></tr>
          </table>
          <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;">
            Or copy this link: <a href="${shareUrl}" style="color:#6b7280;">${shareUrl}</a>
          </p>`;
    return wrapTemplateHtml(bodyHtml, opts.mcBusinessName, branding);
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="padding:40px 40px 32px;">
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">A few questions</p>
          <h1 style="margin:0 0 24px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${title}</h1>
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${coupleName},<br><br>
            ${mcBusinessName} would love a few details to help plan your day. It only takes a couple of minutes, and you can come back to it any time.
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#111827;border-radius:8px;">
              <a href="${shareUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Start questionnaire</a>
            </td></tr>
          </table>
          <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;">
            Or copy this link: <a href="${shareUrl}" style="color:#6b7280;">${shareUrl}</a>
          </p>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Sent by ${mcBusinessName} via Zebri</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function invoiceHtml(
  opts: {
    coupleName: string;
    invoiceNumber: string;
    invoiceTitle: string;
    dueDate: string | null;
    shareUrl: string;
    mcBusinessName: string;
  },
  branding?: PublicBranding | null,
): string {
  const {
    coupleName,
    invoiceNumber,
    invoiceTitle,
    dueDate,
    shareUrl,
    mcBusinessName,
  } = opts;
  const dueLine = dueDate
    ? `<p style="margin:0 0 32px;font-size:14px;color:#374151;">Due: <strong>${dueDate}</strong></p>`
    : "";

  // When branding is provided, use the branded email wrapper; otherwise,
  // preserve the current hardcoded HTML for byte-for-byte compatibility.
  if (branding) {
    const bodyHtml = `<p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Invoice ${invoiceNumber}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${invoiceTitle}</h1>
          ${dueLine}
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${coupleName},<br><br>
            ${mcBusinessName} has sent you an invoice. Click the button below to view it and arrange payment.
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#111827;border-radius:8px;">
              <a href="${shareUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">View Invoice</a>
            </td></tr>
          </table>
          <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;">
            Or copy this link: <a href="${shareUrl}" style="color:#6b7280;">${shareUrl}</a>
          </p>`;
    return wrapTemplateHtml(bodyHtml, opts.mcBusinessName, branding);
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="padding:40px 40px 32px;">
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Invoice ${invoiceNumber}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${invoiceTitle}</h1>
          ${dueLine}
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${coupleName},<br><br>
            ${mcBusinessName} has sent you an invoice. Click the button below to view it and arrange payment.
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#111827;border-radius:8px;">
              <a href="${shareUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">View Invoice</a>
            </td></tr>
          </table>
          <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;">
            Or copy this link: <a href="${shareUrl}" style="color:#6b7280;">${shareUrl}</a>
          </p>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Sent by ${mcBusinessName} via Zebri</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function contractHtml(
  opts: {
    coupleName: string;
    contractNumber: string;
    contractTitle: string;
    expiresAt: string | null;
    shareUrl: string;
    mcBusinessName: string;
  },
  branding?: PublicBranding | null,
): string {
  const {
    coupleName,
    contractNumber,
    contractTitle,
    expiresAt,
    shareUrl,
    mcBusinessName,
  } = opts;
  const expiryLine = expiresAt
    ? `<p style="margin:0 0 32px;font-size:14px;color:#374151;">Please sign by <strong>${expiresAt}</strong>.</p>`
    : "";

  // When branding is provided, use the branded email wrapper; otherwise,
  // preserve the current hardcoded HTML for byte-for-byte compatibility.
  if (branding) {
    const bodyHtml = `<p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Contract ${contractNumber}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${contractTitle}</h1>
          ${expiryLine}
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${coupleName},<br><br>
            ${mcBusinessName} has sent you a contract to review and sign.
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#111827;border-radius:8px;">
              <a href="${shareUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Review &amp; Sign Contract</a>
            </td></tr>
          </table>
          <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;">
            Or copy this link: <a href="${shareUrl}" style="color:#6b7280;">${shareUrl}</a>
          </p>`;
    return wrapTemplateHtml(bodyHtml, opts.mcBusinessName, branding);
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="padding:40px 40px 32px;">
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Contract ${contractNumber}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${contractTitle}</h1>
          ${expiryLine}
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${coupleName},<br><br>
            ${mcBusinessName} has sent you a contract to review and sign.
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#111827;border-radius:8px;">
              <a href="${shareUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Review &amp; Sign Contract</a>
            </td></tr>
          </table>
          <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;">
            Or copy this link: <a href="${shareUrl}" style="color:#6b7280;">${shareUrl}</a>
          </p>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Sent by ${mcBusinessName} via Zebri</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function contractReminderHtml(
  opts: {
    coupleName: string;
    contractNumber: string;
    contractTitle: string;
    expiresAt: string | null;
    shareUrl: string;
    mcBusinessName: string;
  },
  branding?: PublicBranding | null,
): string {
  const {
    coupleName,
    contractNumber,
    contractTitle,
    expiresAt,
    shareUrl,
    mcBusinessName,
  } = opts;
  const expiryLine = expiresAt
    ? `<p style="margin:0 0 32px;font-size:14px;color:#b45309;">Reminder: this contract expires on <strong>${expiresAt}</strong>.</p>`
    : "";

  // When branding is provided, use the branded email wrapper; otherwise,
  // preserve the current hardcoded HTML for byte-for-byte compatibility.
  if (branding) {
    const bodyHtml = `<p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Friendly reminder · Contract ${contractNumber}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${contractTitle}</h1>
          ${expiryLine}
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${coupleName},<br><br>
            Just a gentle nudge - your contract from ${mcBusinessName} is still waiting for your signature.
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#111827;border-radius:8px;">
              <a href="${shareUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Review &amp; Sign</a>
            </td></tr>
          </table>
          <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;">
            Or copy this link: <a href="${shareUrl}" style="color:#6b7280;">${shareUrl}</a>
          </p>`;
    return wrapTemplateHtml(bodyHtml, opts.mcBusinessName, branding);
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="padding:40px 40px 32px;">
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Friendly reminder · Contract ${contractNumber}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${contractTitle}</h1>
          ${expiryLine}
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${coupleName},<br><br>
            Just a gentle nudge - your contract from ${mcBusinessName} is still waiting for your signature.
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#111827;border-radius:8px;">
              <a href="${shareUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Review &amp; Sign</a>
            </td></tr>
          </table>
          <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;">
            Or copy this link: <a href="${shareUrl}" style="color:#6b7280;">${shareUrl}</a>
          </p>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Sent by ${mcBusinessName} via Zebri</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Opts for {@link leadNotificationHtml}: the MC and the submitted lead. */
export interface LeadNotificationOpts {
  mcBusinessName: string;
  lead: {
    name: string;
    partnerName?: string | undefined;
    email: string;
    phone?: string | undefined;
    weddingDate?: string | undefined;
    venue?: string | undefined;
    referralSource?: string | undefined;
    message?: string | undefined;
  };
}

/**
 * Internal notification to the MC that a website lead arrived. Plain neutral
 * shell (no couple-facing branding) - this is an ops email to the MC.
 */
export function leadNotificationHtml(opts: LeadNotificationOpts): string {
  const l = opts.lead;
  const row = (label: string, value?: string) =>
    value && value.trim()
      ? `<tr><td style="padding:4px 12px 4px 0;color:#6B7280;font-size:13px;vertical-align:top;">${escapeHtmlText(
          label,
        )}</td><td style="padding:4px 0;color:#111827;font-size:13px;">${escapeHtmlText(value)}</td></tr>`
      : "";
  const body = `
    <p style="font-size:15px;color:#111827;margin:0 0 12px;">New website enquiry</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
      ${row("Name", l.name)}
      ${row("Partner", l.partnerName)}
      ${row("Email", l.email)}
      ${row("Phone", l.phone)}
      ${row("Wedding date", l.weddingDate)}
      ${row("Venue", l.venue)}
      ${row("Heard via", l.referralSource)}
      ${row("Message", l.message)}
    </table>`;
  return wrapTemplateHtml(body, opts.mcBusinessName);
}

/**
 * Format a date and time in the specified timezone using Intl.DateTimeFormat.
 * Returns a string like "Monday, 15 Sept 2026 at 8:30 PM AEST".
 */
function formatDateTimeInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: timezone,
  });
  const parts = formatter.formatToParts(date);
  const mapped: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      mapped[part.type] = part.value;
    }
  }
  return `${mapped.weekday}, ${mapped.day} ${mapped.month} ${mapped.year} at ${mapped.hour}:${mapped.minute} ${mapped.timeZoneName}`;
}

/**
 * Couple-facing booking confirmation email. Renders the meeting date/time
 * in the booker's timezone plus location info (link, video fallback, address,
 * or phone).
 */
export function bookingConfirmationHtml(opts: {
  bookerName: string;
  meetingTypeName: string;
  start: Date;
  end: Date;
  timezone: string;
  locationType: "video" | "phone" | "in_person";
  address: string | null;
  joinUrl: string | null;
  mcBusinessName: string;
  manageUrl?: string;
}): string {
  const dateTime = formatDateTimeInTimezone(opts.start, opts.timezone);

  let locationLine: string;
  if (opts.locationType === "video" && opts.joinUrl) {
    locationLine = `<a href="${escapeHtmlText(opts.joinUrl)}" style="color:#111827;font-weight:600;">${escapeHtmlText(opts.joinUrl)}</a>`;
  } else if (opts.locationType === "video") {
    locationLine = "Video call (link to follow)";
  } else if (opts.locationType === "in_person" && opts.address) {
    locationLine = escapeHtmlText(opts.address);
  } else if (opts.locationType === "phone") {
    locationLine = "Phone call";
  } else {
    locationLine = "";
  }

  const manageLink = opts.manageUrl
    ? `<p style="margin:24px 0 0;font-size:14px;color:#6b7280;">
        Need to change it? <a href="${escapeHtmlText(opts.manageUrl)}" style="color:#111827;font-weight:600;">Reschedule or cancel</a>
      </p>`
    : "";

  const body = `
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Booking confirmed</p>
    <h1 style="margin:0 0 24px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${escapeHtmlText(opts.meetingTypeName)}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${escapeHtmlText(opts.bookerName)},<br><br>
      Your booking is confirmed. Here are the details.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 32px;">
      <tr><td style="padding:8px 12px 8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Date &amp; time</td><td style="padding:8px 0;color:#111827;font-size:13px;">${escapeHtmlText(dateTime)}</td></tr>
      <tr><td style="padding:8px 12px 8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Meeting type</td><td style="padding:8px 0;color:#111827;font-size:13px;">${escapeHtmlText(opts.meetingTypeName)}</td></tr>
      ${locationLine ? `<tr><td style="padding:8px 12px 8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Location</td><td style="padding:8px 0;color:#111827;font-size:13px;">${locationLine}</td></tr>` : ""}
    </table>
    <p style="margin:0;font-size:14px;color:#6b7280;">
      If you need to reschedule, just let us know.
    </p>${manageLink}`;

  return wrapTemplateHtml(body, opts.mcBusinessName);
}

/**
 * Ops notification email to the MC about a new booking.
 * Uses a table layout mirroring {@link leadNotificationHtml},
 * sent from DEFAULT_FROM with booker email as reply-to.
 */
export function bookingNotificationHtml(opts: {
  mcBusinessName: string;
  booking: {
    bookerName: string;
    bookerEmail: string;
    meetingTypeName: string;
    start: Date;
    end: Date;
    timezone: string;
    locationType: "video" | "phone" | "in_person";
    address: string | null;
    joinUrl: string | null;
  };
}): string {
  const b = opts.booking;
  const dateTime = formatDateTimeInTimezone(b.start, b.timezone);

  let location: string;
  if (b.locationType === "video" && b.joinUrl) {
    location = escapeHtmlText(b.joinUrl);
  } else if (b.locationType === "video") {
    location = "Video call (link to follow)";
  } else if (b.locationType === "in_person" && b.address) {
    location = escapeHtmlText(b.address);
  } else if (b.locationType === "phone") {
    location = "Phone call";
  } else {
    location = "";
  }

  const row = (label: string, value?: string) =>
    value && value.trim()
      ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;vertical-align:top;">${escapeHtmlText(
          label,
        )}</td><td style="padding:4px 0;color:#111827;font-size:13px;">${escapeHtmlText(value)}</td></tr>`
      : "";

  const body = `
    <p style="font-size:15px;color:#111827;margin:0 0 12px;">New booking</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
      ${row("Booker", b.bookerName)}
      ${row("Email", b.bookerEmail)}
      ${row("Meeting type", b.meetingTypeName)}
      ${row("Date & time", dateTime)}
      ${row("Location", location)}
    </table>`;

  return wrapTemplateHtml(body, opts.mcBusinessName);
}

/**
 * Couple-facing booking rescheduled email. Shows the old time (struck through
 * or labelled) and the new time in the booker's timezone, plus manage link.
 */
export function bookingRescheduledHtml(opts: {
  bookerName: string;
  meetingTypeName: string;
  previousStart: Date;
  start: Date;
  end: Date;
  timezone: string;
  locationType: "video" | "phone" | "in_person";
  address: string | null;
  joinUrl: string | null;
  mcBusinessName: string;
  manageUrl: string;
}): string {
  const previousDateTime = formatDateTimeInTimezone(opts.previousStart, opts.timezone);
  const newDateTime = formatDateTimeInTimezone(opts.start, opts.timezone);

  let locationLine: string;
  if (opts.locationType === "video" && opts.joinUrl) {
    locationLine = `<a href="${escapeHtmlText(opts.joinUrl)}" style="color:#111827;font-weight:600;">${escapeHtmlText(opts.joinUrl)}</a>`;
  } else if (opts.locationType === "video") {
    locationLine = "Video call (link to follow)";
  } else if (opts.locationType === "in_person" && opts.address) {
    locationLine = escapeHtmlText(opts.address);
  } else if (opts.locationType === "phone") {
    locationLine = "Phone call";
  } else {
    locationLine = "";
  }

  const body = `
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Booking rescheduled</p>
    <h1 style="margin:0 0 24px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${escapeHtmlText(opts.meetingTypeName)}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${escapeHtmlText(opts.bookerName)},<br><br>
      Your booking has been rescheduled. Here are the updated details.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 32px;">
      <tr><td style="padding:8px 12px 8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Previous time</td><td style="padding:8px 0;color:#666;font-size:13px;"><strike>${escapeHtmlText(previousDateTime)}</strike></td></tr>
      <tr><td style="padding:8px 12px 8px 0;color:#6b7280;font-size:13px;vertical-align:top;">New date &amp; time</td><td style="padding:8px 0;color:#111827;font-size:13px;font-weight:600;">${escapeHtmlText(newDateTime)}</td></tr>
      <tr><td style="padding:8px 12px 8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Meeting type</td><td style="padding:8px 0;color:#111827;font-size:13px;">${escapeHtmlText(opts.meetingTypeName)}</td></tr>
      ${locationLine ? `<tr><td style="padding:8px 12px 8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Location</td><td style="padding:8px 0;color:#111827;font-size:13px;">${locationLine}</td></tr>` : ""}
    </table>
    <p style="margin:0 0 12px;font-size:14px;color:#6b7280;">
      Questions? You can reschedule again or cancel from your booking page.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-top:16px;">
      <tr><td style="background:#111827;border-radius:8px;">
        <a href="${escapeHtmlText(opts.manageUrl)}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Manage booking</a>
      </td></tr>
    </table>`;

  return wrapTemplateHtml(body, opts.mcBusinessName);
}

/**
 * Couple-facing booking cancelled email. Confirms the cancellation with the
 * meeting type and cancelled time. No manage link (there is nothing left to manage).
 */
export function bookingCancelledHtml(opts: {
  bookerName: string;
  meetingTypeName: string;
  start: Date;
  end: Date;
  timezone: string;
  locationType: "video" | "phone" | "in_person";
  address: string | null;
  joinUrl: string | null;
  mcBusinessName: string;
}): string {
  const dateTime = formatDateTimeInTimezone(opts.start, opts.timezone);

  let locationLine: string;
  if (opts.locationType === "video" && opts.joinUrl) {
    locationLine = `<a href="${escapeHtmlText(opts.joinUrl)}" style="color:#111827;font-weight:600;">${escapeHtmlText(opts.joinUrl)}</a>`;
  } else if (opts.locationType === "video") {
    locationLine = "Video call (link to follow)";
  } else if (opts.locationType === "in_person" && opts.address) {
    locationLine = escapeHtmlText(opts.address);
  } else if (opts.locationType === "phone") {
    locationLine = "Phone call";
  } else {
    locationLine = "";
  }

  const body = `
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Booking cancelled</p>
    <h1 style="margin:0 0 24px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${escapeHtmlText(opts.meetingTypeName)}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${escapeHtmlText(opts.bookerName)},<br><br>
      Your booking has been cancelled.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 32px;">
      <tr><td style="padding:8px 12px 8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Meeting type</td><td style="padding:8px 0;color:#111827;font-size:13px;">${escapeHtmlText(opts.meetingTypeName)}</td></tr>
      <tr><td style="padding:8px 12px 8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Was scheduled for</td><td style="padding:8px 0;color:#111827;font-size:13px;">${escapeHtmlText(dateTime)}</td></tr>
      ${locationLine ? `<tr><td style="padding:8px 12px 8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Location</td><td style="padding:8px 0;color:#111827;font-size:13px;">${locationLine}</td></tr>` : ""}
    </table>
    <p style="margin:0;font-size:14px;color:#6b7280;">
      If you would like to reschedule, please get in touch.
    </p>`;

  return wrapTemplateHtml(body, opts.mcBusinessName);
}

/**
 * MC ops notification email for booking changes (reschedule or cancel).
 * Sent from DEFAULT_FROM with booker email as reply-to.
 * Shows times in the MC's timezone and differs by kind in subject and heading.
 */
export function bookingChangeNotificationHtml(opts: {
  mcBusinessName: string;
  kind: "rescheduled" | "cancelled";
  booking: {
    bookerName: string;
    bookerEmail: string;
    meetingTypeName: string;
    start: Date;
    end: Date;
    timezone: string;
    locationType: "video" | "phone" | "in_person";
    address: string | null;
    joinUrl: string | null;
  };
}): string {
  const b = opts.booking;
  const dateTime = formatDateTimeInTimezone(b.start, b.timezone);

  let location: string;
  if (b.locationType === "video" && b.joinUrl) {
    location = escapeHtmlText(b.joinUrl);
  } else if (b.locationType === "video") {
    location = "Video call (link to follow)";
  } else if (b.locationType === "in_person" && b.address) {
    location = escapeHtmlText(b.address);
  } else if (b.locationType === "phone") {
    location = "Phone call";
  } else {
    location = "";
  }

  const heading = opts.kind === "rescheduled" ? "Booking rescheduled" : "Booking cancelled";

  const row = (label: string, value?: string) =>
    value && value.trim()
      ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;vertical-align:top;">${escapeHtmlText(
          label,
        )}</td><td style="padding:4px 0;color:#111827;font-size:13px;">${escapeHtmlText(value)}</td></tr>`
      : "";

  const body = `
    <p style="font-size:15px;color:#111827;margin:0 0 12px;">${heading}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
      ${row("Booker", b.bookerName)}
      ${row("Email", b.bookerEmail)}
      ${row("Meeting type", b.meetingTypeName)}
      ${row("Date & time", dateTime)}
      ${row("Location", location)}
    </table>`;

  return wrapTemplateHtml(body, opts.mcBusinessName);
}

/**
 * Booker-facing reminder email sent the day before a confirmed booking.
 * Time rendered in the booker's timezone; sent via the MC's connected mailbox
 * (if available) or the shared Zebri address. Includes manage link for rescheduling.
 */
export function bookingReminderHtml(opts: {
  bookerName: string;
  meetingTypeName: string;
  start: Date;
  end: Date;
  timezone: string;
  locationType: "video" | "phone" | "in_person";
  address: string | null;
  joinUrl: string | null;
  mcBusinessName: string;
  manageUrl?: string;
}): string {
  const dateTime = formatDateTimeInTimezone(opts.start, opts.timezone);

  let locationLine: string;
  if (opts.locationType === "video" && opts.joinUrl) {
    locationLine = `<a href="${escapeHtmlText(opts.joinUrl)}" style="color:#111827;font-weight:600;">${escapeHtmlText(opts.joinUrl)}</a>`;
  } else if (opts.locationType === "video") {
    locationLine = "Video call (link to follow)";
  } else if (opts.locationType === "in_person" && opts.address) {
    locationLine = escapeHtmlText(opts.address);
  } else if (opts.locationType === "phone") {
    locationLine = "Phone call";
  } else {
    locationLine = "";
  }

  const manageLink = opts.manageUrl
    ? `<p style="margin:24px 0 0;font-size:14px;color:#6b7280;">
        Need to reschedule? <a href="${escapeHtmlText(opts.manageUrl)}" style="color:#111827;font-weight:600;">Update your booking</a>
      </p>`
    : "";

  const body = `
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Reminder: meeting tomorrow</p>
    <h1 style="margin:0 0 24px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${escapeHtmlText(opts.meetingTypeName)}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${escapeHtmlText(opts.bookerName)},<br><br>
      Your meeting with ${escapeHtmlText(opts.mcBusinessName)} is tomorrow. Here are the details.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 32px;">
      <tr><td style="padding:8px 12px 8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Date &amp; time</td><td style="padding:8px 0;color:#111827;font-size:13px;">${escapeHtmlText(dateTime)}</td></tr>
      <tr><td style="padding:8px 12px 8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Meeting type</td><td style="padding:8px 0;color:#111827;font-size:13px;">${escapeHtmlText(opts.meetingTypeName)}</td></tr>
      ${locationLine ? `<tr><td style="padding:8px 12px 8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Location</td><td style="padding:8px 0;color:#111827;font-size:13px;">${locationLine}</td></tr>` : ""}
    </table>
    <p style="margin:0;font-size:14px;color:#6b7280;">
      See you soon.
    </p>${manageLink}`;

  return wrapTemplateHtml(body, opts.mcBusinessName);
}
