/**
 * Pure HTML builders for couple-facing emails (proposal / invoice / contract
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

export function proposalHtml(
  opts: {
    coupleName: string;
    proposalNumber: string;
    proposalTitle: string;
    shareUrl: string;
    mcBusinessName: string;
    /** More than one package option → the copy invites choosing. */
    optionCount: number;
  },
  branding?: PublicBranding | null,
): string {
  const { proposalNumber, shareUrl, optionCount } = opts;
  // User-controlled strings are escaped — titles/names come straight
  // from MC input and land in HTML.
  const coupleName = escapeHtmlText(opts.coupleName);
  const proposalTitle = escapeHtmlText(opts.proposalTitle);
  const mcBusinessName = escapeHtmlText(opts.mcBusinessName);
  const invite =
    optionCount > 1
      ? 'View it to compare the package options, pick the one that fits your day, and respond.'
      : 'Click the button below to view it and respond.';

  // When branding is provided, use the branded email wrapper; otherwise,
  // preserve the current hardcoded HTML for byte-for-byte compatibility.
  if (branding) {
    const bodyHtml = `<p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Proposal ${proposalNumber}</p>
          <h1 style="margin:0 0 24px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${proposalTitle}</h1>
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${coupleName},<br><br>
            ${mcBusinessName} has sent you a proposal. ${invite}
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#111827;border-radius:8px;">
              <a href="${shareUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">View Proposal</a>
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
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Proposal ${proposalNumber}</p>
          <h1 style="margin:0 0 24px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${proposalTitle}</h1>
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${coupleName},<br><br>
            ${mcBusinessName} has sent you a proposal. ${invite}
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#111827;border-radius:8px;">
              <a href="${shareUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">View Proposal</a>
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
