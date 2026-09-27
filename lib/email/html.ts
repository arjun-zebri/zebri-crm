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

import { decodeEntities, PREHEADER_MARKER_ATTR } from "./html-to-text";

export { PREHEADER_MARKER_ATTR };

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
 * component. `send_email`'s legacy plain-text body reaches it through
 * `renderSendEmail` in `./send-email-render`.
 *
 * With `branding` (the MC's resolved {@link PublicBranding}), the footer
 * carries sender identification (ABN, phone, postal address) plus an
 * optional unsubscribe link for commercial sends. Without it, the
 * footer is just "Sent by ... via Zebri", identical to the pre-branding
 * shell (backward compatible).
 *
 * `preheaderSource` is the text the hidden inbox-preview sentence is
 * derived from, when it differs from `body`. Only the review preview
 * passes it: its body carries preview-only gap markers, and the inbox
 * sentence must come from the words the couple actually receives, both
 * so it matches the send and so an excerpt can never cut a marker in
 * half. Omitted, the preheader comes from `body` exactly as before.
 */
export function wrapAutomationShell(
  body: string,
  businessName: string,
  cta?: { label: string; url: string } | undefined,
  branding?: PublicBranding | null,
  unsubscribeUrl?: string | null,
  preheaderSource?: string,
): string {
  const safe = escapeHtmlText(body).replace(/\n/g, "<br>");
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

  // Use the same footer helper as wrapTemplateHtml to ensure consistency
  // between plain-text and rich-text sends. Pass branding for the
  // sender-identification footer; without it, the footer is just the
  // "Sent by ... via Zebri" line.
  const footer = branding || unsubscribeUrl
    ? senderFooterHtml(businessName, branding, unsubscribeUrl)
    : `<p style="margin:0;font-size:12px;color:#9ca3af;">Sent by ${escapeHtmlText(businessName)} via Zebri</p>`;

  // The body here is already plain text (resolved variables, no markup),
  // so `isHtml: false` skips the tag-stripper and only collapses
  // whitespace before deriving.
  const preheader = autoPreheaderHtml(preheaderSource ?? body, false);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  ${preheader}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="padding:40px;font-size:15px;color:#374151;line-height:1.6;">${safe}${action}</td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;">
          ${footer}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Escape an HTML text node for safe rendering.
 *
 * Escapes `&`, `<`, `>`, `"` and `'` so the text cannot break out of
 * or inject into attribute context (e.g. an `alt=""` attribute).
 * When this output ends up in text-node content the `&quot;` and `&#39;`
 * render as plain characters, so there is no visual change; when used
 * in an attribute value, the escaped form keeps the attribute boundary
 * intact.
 */
function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Shortest and longest length, in characters, an auto-derived preheader
 *  is cut to (Task 32 ruling: "~90-110 chars, cut at a word boundary"). */
const PREHEADER_MIN_CHARS = 90;
const PREHEADER_MAX_CHARS = 110;

/**
 * Reduce a rendered body to flat text {@link derivePreheaderText} can read.
 *
 * Strips every tag and decodes entities, collapsing whitespace to single
 * spaces. Not a general HTML-to-text conversion (see `./html-to-text` for
 * the one that builds the real text/plain alternative): the preheader is
 * one flat inbox-preview sentence, so a link's URL, a list's bullets and
 * a table's rows all just become adjacent words, never a structured
 * rendering.
 *
 * Only real tags are stripped: a `<` followed by a letter, `/` or `!`
 * (Task 32 review M2, closed in the Phase 5 fix wave). Several shells
 * interpolate a couple name raw, and a browser shows "Tom <3 Jo" as text,
 * so the preheader has to as well; the old `<[^>]*>` ate everything from
 * the `<` to the next tag. Callers with a genuinely plain-text source
 * still skip this (see {@link autoPreheaderHtml}'s `isHtml` flag).
 *
 * @param html - Body markup, tags included.
 */
export function stripTagsForPreheader(html: string): string {
  return decodeEntities(html.replace(/<\/?[a-zA-Z!][^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Matches a bare URL so it can be dropped before a preheader is derived
 * (Task 32 review I2): an `http(s)://` link, a `www.` host, or a
 * schemeless domain followed by a path (`zebri.com.au/portal/<token>`,
 * the form an MC types by hand; closed in the Phase 5 fix wave).
 *
 * A resolved link variable (`{{portal.link}}`, `{{contract.link}}`, …)
 * becomes a raw capability URL in a plain-text automation body, and an MC
 * can paste a bare link as its own anchor label in a rich one. Either way
 * the token that URL carries must never end up as the one thing an inbox
 * shows next to the subject line.
 *
 * The schemeless form needs a letters-only top-level label AND a `/`
 * straight after it, so prose with dots in it ("5.30pm", "e.g. after",
 * "the end.Next") is left alone; a bare domain with no path carries no
 * token and is left alone too.
 */
const PREHEADER_URL_TOKEN =
  /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/\S*/gi;

/**
 * Drop URL tokens from text already reduced to flat, tag-free words (Task
 * 32 review I2), and re-collapse the whitespace left behind.
 *
 * Applied before {@link derivePreheaderText}, never after: dropping a URL
 * post-truncation cannot undo a hard cut that already landed mid-token,
 * which is exactly the M1/I2 "partial token URL" failure the review found.
 */
function stripUrlsForPreheader(text: string): string {
  return text.replace(PREHEADER_URL_TOKEN, " ").replace(/\s+/g, " ").trim();
}

/**
 * Derive the inbox-preview sentence from the start of a rendered email body.
 *
 * Per the Task 32 ruling, the preheader is always computed from the same
 * resolved content that renders as the body, never a separate field a
 * caller fills in: that is what guarantees it can never show a raw
 * `{{token}}` or say something the body itself does not. Cuts at a word
 * boundary between {@link PREHEADER_MIN_CHARS} and
 * {@link PREHEADER_MAX_CHARS} characters, so a long body is never
 * truncated mid-word. A body already shorter than the cap comes back
 * untouched, and an empty body comes back as `""` (the caller then
 * renders no preheader element at all: see {@link preheaderHtml}).
 *
 * Cut positions are backed off a UTF-16 code unit when they would land
 * inside a surrogate pair (Task 32 review M3): a hard cut that splits one
 * lands on a lone surrogate, which renders as a broken glyph (U+FFFD) in
 * the preview instead of the character being left out cleanly.
 *
 * @param plainText - Resolved, tag- and URL-free text (see
 *   {@link stripTagsForPreheader} and {@link stripUrlsForPreheader}).
 */
export function derivePreheaderText(plainText: string): string {
  const trimmed = plainText.trim();
  if (trimmed.length <= PREHEADER_MAX_CHARS) return trimmed;

  const window = trimmed.slice(0, PREHEADER_MAX_CHARS + 1);
  const lastSpace = window.lastIndexOf(" ");
  // A space inside the target window keeps every word whole. A single
  // unbroken run of characters (no space anywhere in the window) has
  // nothing to cut on, so it hard-cuts at the cap instead of overshooting.
  const cut = lastSpace >= PREHEADER_MIN_CHARS ? lastSpace : PREHEADER_MAX_CHARS;
  return trimmed.slice(0, backOffSurrogatePair(trimmed, cut)).trim();
}

/**
 * If `index` sits between the two UTF-16 units of a surrogate pair (a
 * character outside the Basic Multilingual Plane, most emoji included),
 * step back one unit so a slice at `index` never separates them (Task 32
 * review M3).
 */
function backOffSurrogatePair(text: string, index: number): number {
  const code = text.charCodeAt(index);
  const isLowSurrogate = code >= 0xdc00 && code <= 0xdfff;
  return isLowSurrogate ? index - 1 : index;
}

/**
 * The hidden "preheader" element every couple-facing shell emits as the
 * very first thing inside `<body>` (Task 32).
 *
 * Gmail, Apple Mail and Outlook all show a snippet of the message next to
 * its subject in the inbox list, and by default that snippet is whatever
 * text node the client finds first in the body, usually the "Sent by …
 * via Zebri" footer line, or nothing readable at all. Putting a genuine,
 * resolved sentence here first is what makes that snippet read like part
 * of the email instead of plumbing.
 *
 * The markup layers three independent hiding techniques (`display:none`,
 * a collapsed box via `max-height`/`overflow`/`opacity`, and Outlook's own
 * `mso-hide`) because no single one is honoured by every client, and pads
 * the text out with alternating `&zwnj;`/`&nbsp;`, repeated enough times
 * (Task 32 review M1: the original 16 pairs, 32 invisible characters, was
 * not enough to stop a short body's snippet bleeding into whatever
 * visible text follows, whether that is a CTA button, the branding
 * header or the footer) that a client reading past the preheader's own
 * text for its snippet has well over 100 further invisible characters to
 * get through before it reaches anything visible. `htmlToText` strips
 * this element wholesale by {@link PREHEADER_MARKER_ATTR}, so the derived
 * text/plain alternative never repeats it.
 *
 * No dark-mode styling here or anywhere else in the shell (owner cut that
 * half of Task 32): this element is hidden by every mechanism above
 * regardless of the client's colour scheme, so it needs none of its own.
 *
 * @param text - The preheader sentence, already safe to show as-is: the
 *   auto-derived one from {@link derivePreheaderText}, or a caller's own
 *   fixed, code-free text (see {@link contractOtpHtml}). Returns `""` for
 *   empty input, so a body with no derivable text renders no preheader
 *   element at all rather than an empty hidden one.
 */
export function preheaderHtml(text: string): string {
  if (!text) return "";
  // 90 pairs decode to 180 invisible characters, well past the "roughly
  // 100 or more" the Task 32 review asked for, on top of the up-to-110
  // characters of real preheader text ahead of it.
  const padding = "&zwnj;&nbsp;".repeat(90);
  return `<div ${PREHEADER_MARKER_ATTR}="true" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;font-size:1px;color:#f9f9f9;mso-hide:all;">${escapeHtmlText(text)} ${padding}</div>`;
}

/**
 * The one auto-preheader pipeline every shell calls (Task 32 review M5):
 * normalise the body to flat text, drop any bare URL, derive the ~90-110
 * character preview sentence, and render the hidden element. Replaces
 * what used to be a `preheaderHtml(derivePreheaderText(stripTagsForPreheader(x)))`
 * sequence repeated at every call site.
 *
 * @param source - The rendered body this preheader previews.
 * @param isHtml - `true` (the default) for a rendered HTML body, whose
 *   tags are stripped first. `false` for the automation shell's
 *   already-plain-text body: running the HTML tag-stripper on arbitrary
 *   plain text risks eating real content that merely contains a `<` or
 *   `>` (the parked M2 class), so a plain-text source only has its
 *   whitespace collapsed.
 */
export function autoPreheaderHtml(source: string, isHtml = true): string {
  const flat = isHtml ? stripTagsForPreheader(source) : source.replace(/\s+/g, " ").trim();
  return preheaderHtml(derivePreheaderText(stripUrlsForPreheader(flat)));
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

/** The subset of {@link PublicBranding} the sender-identification footer
 *  reads. Narrowed to just these three so callers that only have loose
 *  identity fields (not a full resolved branding object) can still use it. */
export interface FooterIdentity {
  abn?: string | null;
  phone?: string | null;
  postal_address?: string | null;
}

/**
 * The sender-identification line every couple-facing email carries below
 * "Sent by … via Zebri", plus an optional unsubscribe link.
 *
 * The Australian Spam Act requires a commercial electronic message to
 * clearly identify who sent it and how to contact them. ABN, phone and
 * postal address are read from the MC's branding when set; a field the
 * MC has never filled in is simply left out of the line rather than
 * rendered blank. Blocking the send until every field is filled in would
 * break every existing user the moment this ships, and a legally
 * required field shown blank reads worse than a line that just carries
 * fewer facts, so this degrades instead of gating.
 *
 * `unsubscribeUrl` is deliberately a plain string the caller supplies,
 * never something this function decides on its own: whether a given send
 * is "commercial" (needs the link) or "transactional" (does not) is a
 * classification that will change once legal advice lands (see
 * `lib/email/commercial-classification.ts`), so that decision has to stay
 * in the caller, not get baked into the renderer.
 */
function senderFooterHtml(
  mcBusinessName: string,
  branding: FooterIdentity | null | undefined,
  unsubscribeUrl?: string | null,
): string {
  const safeName = escapeHtmlText(mcBusinessName);
  const identityLine = `<p style="margin:0;font-size:12px;color:#9ca3af;">Sent by ${safeName} via Zebri</p>`;

  const details = [
    branding?.abn ? `ABN ${escapeHtmlText(branding.abn)}` : null,
    branding?.phone ? escapeHtmlText(branding.phone) : null,
    branding?.postal_address ? escapeHtmlText(branding.postal_address) : null,
  ].filter((value): value is string => value !== null);
  const detailsLine = details.length
    ? `<p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">${details.join(" &middot; ")}</p>`
    : "";

  const safeUnsubscribeUrl = safeUrl(unsubscribeUrl);
  const unsubscribeLine = safeUnsubscribeUrl
    ? `<p style="margin:8px 0 0;font-size:12px;color:#9ca3af;"><a href="${safeUnsubscribeUrl}" style="color:#6b7280;">Unsubscribe</a> from these emails</p>`
    : "";

  return `${identityLine}${detailsLine}${unsubscribeLine}`;
}

/**
 * Append the sender-identification and unsubscribe block to an email
 * that was rendered without the branded shell.
 *
 * A commercial message has to identify its sender and carry a working
 * unsubscribe facility in the message itself; the `List-Unsubscribe`
 * header alone is not reliably shown, and some transports (Microsoft
 * Graph) cannot carry it at all. So when a commercial send's body did
 * not come through a shell that already renders the footer (a
 * `send_email` step with `wrap: false`, or an action whose renderer
 * ignored the link), this adds a minimal one. It goes just before
 * `</body>` when the HTML has one, else at the end.
 *
 * @param html - The rendered email.
 * @param mcBusinessName - Shown in the "Sent by ... via Zebri" line.
 * @param branding - ABN, phone and postal address, when the MC set them.
 * @param unsubscribeUrl - This recipient's unsubscribe page link.
 */
export function appendComplianceFooter(
  html: string,
  mcBusinessName: string,
  branding: FooterIdentity | null | undefined,
  unsubscribeUrl: string,
): string {
  const block = `<div style="margin-top:24px;padding-top:12px;border-top:1px solid #f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${senderFooterHtml(mcBusinessName, branding, unsubscribeUrl)}</div>`;
  const close = html.toLowerCase().lastIndexOf("</body>");
  return close === -1 ? `${html}${block}` : `${html.slice(0, close)}${block}${html.slice(close)}`;
}

/**
 * Wrap an already-rendered (HTML) email body in the outgoing shell.
 * Unlike {@link wrapAutomationShell} (which escapes a
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
 * The footer always carries sender identification (business name, and
 * ABN / phone / postal address when `branding` has them; see
 * {@link senderFooterHtml}). Pass `unsubscribeUrl` to add the one-click
 * unsubscribe link for a commercial send; omit it for a transactional
 * one (the caller decides which, this function just renders).
 *
 * The same function feeds the editor's WYSIWYG preview iframe and the
 * send route, so the preview is exactly what lands in the inbox.
 *
 * By default the preheader (Task 32) is auto-derived from `bodyHtml`.
 * Pass a fixed string as `preheaderText` to use exactly that text instead
 * (no derivation, no URL scrub: the caller is asserting it is already
 * safe). The one caller that needs this is {@link contractOtpHtml}, whose
 * body opens with a one-time code and needs a fixed, code-free sentence
 * in its place. Pass `preheaderText: null` to render no preheader element
 * at all.
 */
export function wrapTemplateHtml(
  bodyHtml: string,
  mcBusinessName: string,
  branding?: PublicBranding | null,
  unsubscribeUrl?: string | null,
  preheaderText?: string | null,
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

  // Derived from bodyHtml, before the header/footer are added around it,
  // so the preheader can never repeat either of them (Task 32 ruling).
  // `preheaderText === null` is the explicit opt-out (see the doc comment
  // above): rendered as no preheader element at all, never an empty one.
  // A given string (not null/undefined) is a caller's own fixed, already
  // safe text, rendered as-is with no auto-derivation.
  const preheader =
    preheaderText === null
      ? ""
      : preheaderText !== undefined
        ? preheaderHtml(preheaderText)
        : autoPreheaderHtml(bodyHtml);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${fontsLink}${headStyles}</head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:${bodyStack};">
  ${preheader}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:${radius}px;border:1px solid #e5e7eb;overflow:hidden;">
        ${accentBar}${header}
        <tr><td class="zb-body" style="padding:32px 40px 40px;font-family:${bodyStack};font-weight:${bodyWeight};font-size:15px;color:#374151;line-height:1.6;">${bodyHtml}</td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;">
          ${senderFooterHtml(mcBusinessName, branding, unsubscribeUrl)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * The questionnaire invitation email.
 *
 * Pass `unsubscribeUrl` when the send is commercial (the automated
 * `send_couple_questionnaire` step is, by the classification in
 * `lib/email/commercial-classification.ts`): the footer then carries the
 * sender identification and the unsubscribe link. Without it the output
 * is unchanged, which is what the manual send from the couple profile
 * still gets.
 */
export function questionnaireHtml(
  opts: {
    coupleName: string;
    title: string;
    shareUrl: string;
    mcBusinessName: string;
  },
  branding?: PublicBranding | null,
  unsubscribeUrl?: string | null,
): string {
  const { coupleName, title, shareUrl, mcBusinessName } = opts;

  // Hoisted above the branding branch: both paths show the same copy, so
  // computing it once keeps the preheader (derived below) in sync with
  // whichever shell actually renders it.
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

  // When branding is provided, use the branded email wrapper; otherwise,
  // preserve the current hardcoded HTML for byte-for-byte compatibility.
  if (branding) return wrapTemplateHtml(bodyHtml, opts.mcBusinessName, branding, unsubscribeUrl);

  const footer = unsubscribeUrl
    ? senderFooterHtml(mcBusinessName, null, unsubscribeUrl)
    : `<p style="margin:0;font-size:12px;color:#9ca3af;">Sent by ${mcBusinessName} via Zebri</p>`;
  const preheader = autoPreheaderHtml(bodyHtml);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  ${preheader}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="padding:40px 40px 32px;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;">
          ${footer}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * The neutral (unbranded) card shell every couple-facing email falls back to
 * when the sender has no {@link PublicBranding}.
 *
 * Extracted from {@link invoiceHtml} so `proposalHtml` can reuse the exact
 * same wrapper: the two emails previously carried independent copies of this
 * markup, and a future tweak to one would silently drift from the other.
 *
 * @param bodyHtml - Pre-rendered inner content (heading, CTA, links).
 * @param mcBusinessName - Shown in the "Sent by … via Zebri" footer.
 */
function plainCardHtml(bodyHtml: string, mcBusinessName: string): string {
  const preheader = autoPreheaderHtml(bodyHtml);
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  ${preheader}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="padding:40px 40px 32px;">
          ${bodyHtml}
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

  // When branding is provided, use the branded email wrapper; otherwise,
  // fall back to the plain card, preserved byte-for-byte via `plainCardHtml`.
  if (branding) return wrapTemplateHtml(bodyHtml, opts.mcBusinessName, branding);
  return plainCardHtml(bodyHtml, mcBusinessName);
}

/**
 * Proposal email body. Same skeleton as {@link invoiceHtml}: a branded
 * wrapper when the sender has branding, else the plain card.
 */
export function proposalHtml(
  opts: {
    coupleName: string;
    proposalNumber: string;
    proposalTitle: string;
    expiresAt: string | null;
    shareUrl: string;
    mcBusinessName: string;
  },
  branding?: PublicBranding | null,
): string {
  const { coupleName, proposalNumber, proposalTitle, expiresAt, shareUrl, mcBusinessName } = opts;
  const expiryLine = expiresAt
    ? `<p style="margin:0 0 32px;font-size:14px;color:#374151;">Valid until: <strong>${expiresAt}</strong></p>`
    : "";
  const bodyHtml = `<p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Proposal ${proposalNumber}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${proposalTitle}</h1>
          ${expiryLine}
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${coupleName},<br><br>
            ${mcBusinessName} has put together a proposal for your day. Open it to see the options and choose the one that suits you.
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#111827;border-radius:8px;">
              <a href="${shareUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">View proposal</a>
            </td></tr>
          </table>
          <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;">
            Or copy this link: <a href="${shareUrl}" style="color:#6b7280;">${shareUrl}</a>
          </p>`;
  if (branding) return wrapTemplateHtml(bodyHtml, mcBusinessName, branding);
  return plainCardHtml(bodyHtml, mcBusinessName);
}

/**
 * MC-facing notification: a couple accepted a proposal option. Sent from
 * the finalize step, so by the time it lands the contract is signed and the
 * invoice exists; the copy says so rather than "ready for signature".
 *
 * Unlike the couple-facing builders above (Resend's shared address only),
 * this one is sent to the MC themselves, so it reuses the same
 * branded/plain wrapper split for consistency with every other Zebri
 * notification they receive. Names are escaped: the couple's name and the
 * package title are free text the MC (or the couple, via the lead form)
 * typed, and an email body is HTML.
 */
export function proposalAcceptedHtml(
  opts: {
    coupleName: string;
    proposalNumber: string;
    proposalTitle: string;
    packageName: string;
    total: number;
    invoiceNumber: string;
    detailUrl: string;
    mcBusinessName: string;
  },
  branding?: PublicBranding | null,
): string {
  const { coupleName, proposalNumber, proposalTitle, packageName, total, invoiceNumber, detailUrl, mcBusinessName } = opts;
  const bodyHtml = `<p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Proposal ${escapeHtmlText(proposalNumber)}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${escapeHtmlText(proposalTitle)}</h1>
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6;">
            ${escapeHtmlText(coupleName)} accepted <strong>${escapeHtmlText(packageName)}</strong> at $${total.toFixed(2)} and signed the contract. Invoice ${escapeHtmlText(invoiceNumber)} has been generated.
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#111827;border-radius:8px;">
              <a href="${detailUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Open in Zebri</a>
            </td></tr>
          </table>`;
  if (branding) return wrapTemplateHtml(bodyHtml, mcBusinessName, branding);
  return plainCardHtml(bodyHtml, mcBusinessName);
}

/**
 * MC-facing notification: the couple opened the proposal's public page for
 * the first time. Sent once per proposal (the events route only calls this
 * on `first_open`), so the copy leans into "just opened" rather than
 * repeat-view language.
 *
 * Same escaping posture as {@link proposalAcceptedHtml}: the couple's name
 * and the proposal title are free text, and an email body is HTML.
 */
export function proposalOpenedHtml(
  opts: {
    coupleName: string;
    proposalNumber: string;
    proposalTitle: string;
    detailUrl: string;
    mcBusinessName: string;
  },
  branding?: PublicBranding | null,
): string {
  const { coupleName, proposalNumber, proposalTitle, detailUrl, mcBusinessName } = opts;
  const bodyHtml = `<p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Proposal ${escapeHtmlText(proposalNumber)}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${escapeHtmlText(proposalTitle)}</h1>
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6;">
            ${escapeHtmlText(coupleName)} just opened your proposal ${escapeHtmlText(proposalTitle)}. You can watch how they read it on the proposal page.
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#111827;border-radius:8px;">
              <a href="${detailUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Open in Zebri</a>
            </td></tr>
          </table>`;
  if (branding) return wrapTemplateHtml(bodyHtml, mcBusinessName, branding);
  return plainCardHtml(bodyHtml, mcBusinessName);
}

/**
 * MC-facing notification: a couple declined a proposal.
 *
 * Every free-text field is HTML-escaped: the couple's message obviously, but
 * also the names and the reason label, since an email body is HTML and a
 * name with an angle bracket in it must not become markup.
 */
export function proposalDeclinedHtml(
  opts: {
    coupleName: string;
    proposalNumber: string;
    proposalTitle: string;
    reasonLabel: string;
    message: string | null;
    detailUrl: string;
    mcBusinessName: string;
  },
  branding?: PublicBranding | null,
): string {
  const { coupleName, proposalNumber, proposalTitle, reasonLabel, message, detailUrl, mcBusinessName } = opts;
  const messageLine = message
    ? `<p style="margin:0 0 24px;font-size:14px;color:#374151;font-style:italic;">&ldquo;${escapeHtmlText(message)}&rdquo;</p>`
    : "";
  const bodyHtml = `<p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Proposal ${escapeHtmlText(proposalNumber)}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${escapeHtmlText(proposalTitle)}</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
            ${escapeHtmlText(coupleName)} declined this proposal: <strong>${escapeHtmlText(reasonLabel)}</strong>.
          </p>
          ${messageLine}
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#111827;border-radius:8px;">
              <a href="${detailUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Open in Zebri</a>
            </td></tr>
          </table>`;
  if (branding) return wrapTemplateHtml(bodyHtml, mcBusinessName, branding);
  return plainCardHtml(bodyHtml, mcBusinessName);
}

/**
 * One party's personal signing link.
 *
 * A contract can require both partners, and each holds their OWN capability
 * token, so a single shared URL cannot stand in for the pair.
 */
export interface SignerLink {
  /** The signer's name, used to label their button ("Sign as Sarah"). */
  name: string;
  /** That signer's personal `/contract/<sign_token>` URL. */
  url: string;
}

/**
 * The call-to-action block for a contract email: a button per signer plus the
 * copyable URLs beneath.
 *
 * WHY IT TAKES A LIST. Partners frequently share one inbox. The send and
 * reminder routes used to de-duplicate recipients by address, which silently
 * dropped the second partner's link entirely, leaving them unable to sign and
 * the contract unable to ever complete. Dropping the dedup instead would send
 * two near-identical emails carrying different links, inviting the wrong
 * person to sign the wrong one. Grouping by address and naming each button is
 * what resolves both failures at once.
 *
 * @param shareUrl - Fallback single URL, used when `links` is absent.
 * @param label - Button text in the single-link case.
 * @param links - One entry per signer at this address. Absent or length 1
 *   reproduces the historical single-button markup byte for byte.
 */
function signCtaBlock(
  shareUrl: string,
  label: string,
  links?: SignerLink[],
): string {
  const btn = (url: string, text: string) =>
    `<tr><td style="background:#111827;border-radius:8px;">
              <a href="${url}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${text}</a>
            </td></tr>`;

  // Single-signer (and the no-links default) keeps the exact historical markup
  // so every existing contract email renders identically.
  if (!links || links.length <= 1) {
    const url = links?.[0]?.url ?? shareUrl;
    return `<table cellpadding="0" cellspacing="0">
            ${btn(url, label)}
          </table>
          <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;">
            Or copy this link: <a href="${url}" style="color:#6b7280;">${url}</a>
          </p>`;
  }

  const spacer = `<tr><td style="height:12px;"></td></tr>`;
  const buttons = links
    .map((l) => btn(l.url, `Sign as ${escapeHtmlText(l.name)}`))
    .join(`\n            ${spacer}\n            `);
  const copyLines = links
    .map(
      (l) =>
        `<p style="margin:0 0 8px;font-size:13px;color:#9ca3af;">
            ${escapeHtmlText(l.name)}: <a href="${l.url}" style="color:#6b7280;">${l.url}</a>
          </p>`,
    )
    .join("\n          ");

  return `<table cellpadding="0" cellspacing="0">
            ${buttons}
          </table>
          <p style="margin:32px 0 12px;font-size:13px;color:#374151;">
            You each sign separately, so please use your own link.
          </p>
          ${copyLines}`;
}

export function contractHtml(
  opts: {
    coupleName: string;
    contractNumber: string;
    contractTitle: string;
    expiresAt: string | null;
    shareUrl: string;
    mcBusinessName: string;
    /** One entry per signer sharing this address. See {@link signCtaBlock}. */
    links?: SignerLink[];
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
    links,
  } = opts;
  const expiryLine = expiresAt
    ? `<p style="margin:0 0 32px;font-size:14px;color:#374151;">Please sign by <strong>${expiresAt}</strong>.</p>`
    : "";
  const cta = signCtaBlock(shareUrl, "Review &amp; Sign Contract", links);

  // Hoisted above the branding branch: both paths show the same copy, so
  // computing it once keeps the preheader (derived below) in sync with
  // whichever shell actually renders it.
  const bodyHtml = `<p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Contract ${contractNumber}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${contractTitle}</h1>
          ${expiryLine}
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${coupleName},<br><br>
            ${mcBusinessName} has sent you a contract to review and sign.
          </p>
          ${cta}`;

  // When branding is provided, use the branded email wrapper; otherwise,
  // preserve the current hardcoded HTML for byte-for-byte compatibility.
  if (branding) return wrapTemplateHtml(bodyHtml, opts.mcBusinessName, branding);

  const preheader = autoPreheaderHtml(bodyHtml);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  ${preheader}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="padding:40px 40px 32px;">
          ${bodyHtml}
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

/**
 * "Your contract is signed" email, sent to every party once the last required
 * signature lands.
 *
 * Closes a real gap: nothing used to be sent after signing, so neither side
 * held a copy of the executed agreement. Australia's Electronic Transactions
 * Act contemplates the document being retained in a form accessible for later
 * reference, and it is ordinary practice for each signatory to receive one.
 *
 * @param opts.signerNames - Everyone who signed, in signing order.
 * @param opts.shareUrl - Link to the signed contract, which renders the frozen
 * `locked_content_html` plus the audit trail and offers a PDF.
 */
export function contractSignedHtml(
  opts: {
    recipientName: string;
    contractNumber: string;
    contractTitle: string;
    signerNames: string[];
    signedAt: string | null;
    shareUrl: string;
    mcBusinessName: string;
  },
  branding?: PublicBranding | null,
): string {
  const {
    recipientName,
    contractNumber,
    contractTitle,
    signerNames,
    signedAt,
    shareUrl,
    mcBusinessName,
  } = opts;

  const signedLine = signedAt
    ? `<p style="margin:0 0 24px;font-size:14px;color:#374151;">Completed on <strong>${signedAt}</strong>.</p>`
    : "";
  const parties = signerNames.length
    ? `<p style="margin:0 0 24px;font-size:14px;color:#374151;">Signed by ${signerNames.join(", ")}.</p>`
    : "";

  const bodyHtml = `<p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Contract ${contractNumber}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${contractTitle}</h1>
          ${signedLine}
          ${parties}
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${recipientName},<br><br>
            This contract is now fully signed. Keep this email for your records &mdash; the link below opens your copy, including the signing audit trail, and lets you download a PDF.
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#111827;border-radius:8px;">
              <a href="${shareUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">View signed contract</a>
            </td></tr>
          </table>
          <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;">
            Or copy this link: <a href="${shareUrl}" style="color:#6b7280;">${shareUrl}</a>
          </p>`;

  if (branding) return wrapTemplateHtml(bodyHtml, mcBusinessName, branding);

  const preheader = autoPreheaderHtml(bodyHtml);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  ${preheader}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="padding:40px 40px 32px;">${bodyHtml}</td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Sent by ${mcBusinessName} via Zebri</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * The one-time code a signer enters before signing.
 *
 * The code is in the BODY only, never the subject: a subject line shows in
 * notification previews on a lock screen, which is exactly the shoulder-surfing
 * case the code is meant to resist. An auto-derived preheader would read
 * the start of the body, which is exactly where the code lives, and put
 * it right back into that same inbox-preview / lock-screen surface. So
 * this function never auto-derives one; instead both paths get a fixed,
 * code-free preheader (Task 32 review I1) that names the contract and the
 * expiry the body already states, with the same generous padding every
 * other shell uses to keep a client from reading past it into the code.
 */
export function contractOtpHtml(
  opts: {
    recipientName: string;
    code: string;
    contractNumber: string;
    mcBusinessName: string;
    minutes: number;
  },
  branding?: PublicBranding | null,
): string {
  const { recipientName, code, contractNumber, mcBusinessName, minutes } = opts;
  const bodyHtml = `<p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Contract ${escapeHtmlText(contractNumber)}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">Your signing code</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${escapeHtmlText(recipientName)},<br><br>
            Enter this code on the contract page to confirm it's you.
          </p>
          <p style="margin:0 0 24px;font-size:32px;font-weight:600;letter-spacing:0.2em;color:#111827;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtmlText(code)}</p>
          <p style="margin:0;font-size:13px;color:#9ca3af;">
            The code expires in ${String(minutes)} minutes. If you didn't ask to sign a contract from ${escapeHtmlText(mcBusinessName)}, you can ignore this email.
          </p>`;

  // Fixed and code-free on both paths: never derived from bodyHtml, whose
  // start is exactly where the code lives (Task 32 review I1).
  const safePreheader = `Your signing code for contract ${contractNumber}. It expires in ${String(minutes)} minutes.`;

  if (branding) return wrapTemplateHtml(bodyHtml, mcBusinessName, branding, undefined, safePreheader);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  ${preheaderHtml(safePreheader)}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="padding:40px 40px 32px;">${bodyHtml}</td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Sent by ${escapeHtmlText(mcBusinessName)} via Zebri</p>
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
