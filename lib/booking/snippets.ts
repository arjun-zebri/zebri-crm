/**
 * Copy-paste embed snippet builders for the booking page. Pure string
 * helpers shared by the Calendar settings section; `origin` is the app origin
 * (e.g. https://app.zebri.com.au) resolved at call time.
 *
 * @module lib/booking/snippets
 */

/** The standalone hosted booking page URL. */
export function buildHostedUrl(origin: string, token: string): string {
  return `${origin}/book/${token}`;
}

/** An iframe embed that renders the chromeless booking page. */
export function buildIframeSnippet(origin: string, token: string): string {
  return `<iframe src="${origin}/book/${token}?embed=1" title="Booking form" style="width:100%;border:0;min-height:640px" loading="lazy"></iframe>`;
}

/** A script snippet: the loader injects the iframe and auto-resizes it. */
export function buildScriptSnippet(origin: string, token: string): string {
  return `<script src="${origin}/book-embed.js" data-zebri-booking="${token}" async></script>`;
}
