import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "Zebri <noreply@app.zebri.com.au>";

function quoteHtml(opts: {
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

function invoiceHtml(opts: {
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

export async function sendQuoteEmail(opts: {
  coupleEmail: string;
  coupleName: string;
  quoteNumber: string;
  quoteTitle: string;
  shareUrl: string;
  mcBusinessName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await resend.emails.send({
    from: FROM,
    to: opts.coupleEmail,
    subject: `Quote from ${opts.mcBusinessName} — ${opts.quoteNumber}`,
    html: quoteHtml(opts),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function sendInvoiceEmail(opts: {
  coupleEmail: string;
  coupleName: string;
  invoiceNumber: string;
  invoiceTitle: string;
  dueDate: string | null;
  shareUrl: string;
  mcBusinessName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await resend.emails.send({
    from: FROM,
    to: opts.coupleEmail,
    subject: `Invoice from ${opts.mcBusinessName} — ${opts.invoiceNumber}`,
    html: invoiceHtml(opts),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
