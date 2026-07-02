/**
 * Pure HTML builders for couple-facing emails (quote / invoice / contract
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

/**
 * Wrap an already-rendered (HTML) email body in the standard
 * Zebri-branded shell. Unlike the automation `wrapAutomationHtml`
 * (which escapes a plain-text body), this embeds trusted, sanitised
 * HTML produced by `renderEmailTemplate`.
 */
export function wrapTemplateHtml(bodyHtml: string, mcBusinessName: string): string {
  const safeName = mcBusinessName
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="padding:40px;font-size:15px;color:#374151;line-height:1.6;">${bodyHtml}</td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Sent by ${safeName} via Zebri</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function quoteHtml(opts: {
  coupleName: string;
  quoteNumber: string;
  quoteTitle: string;
  shareUrl: string;
  mcBusinessName: string;
}): string {
  const { coupleName, quoteNumber, quoteTitle, shareUrl, mcBusinessName } =
    opts;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="padding:40px 40px 32px;">
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Quote ${quoteNumber}</p>
          <h1 style="margin:0 0 24px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${quoteTitle}</h1>
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${coupleName},<br><br>
            ${mcBusinessName} has sent you a quote. Click the button below to view it and respond.
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#111827;border-radius:8px;">
              <a href="${shareUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">View Quote</a>
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

export function questionnaireHtml(opts: {
  coupleName: string;
  title: string;
  shareUrl: string;
  mcBusinessName: string;
}): string {
  const { coupleName, title, shareUrl, mcBusinessName } = opts;
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

export function invoiceHtml(opts: {
  coupleName: string;
  invoiceNumber: string;
  invoiceTitle: string;
  dueDate: string | null;
  shareUrl: string;
  mcBusinessName: string;
}): string {
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

export function contractHtml(opts: {
  coupleName: string;
  contractNumber: string;
  contractTitle: string;
  expiresAt: string | null;
  shareUrl: string;
  mcBusinessName: string;
}): string {
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

export function contractReminderHtml(opts: {
  coupleName: string;
  contractNumber: string;
  contractTitle: string;
  expiresAt: string | null;
  shareUrl: string;
  mcBusinessName: string;
}): string {
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
