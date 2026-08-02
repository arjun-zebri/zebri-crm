/**
 * Copy-paste embed snippet builders for the lead-capture form. Pure string
 * helpers shared by the Settings section; `origin` is the app origin
 * (e.g. https://app.zebri.com.au) resolved at call time.
 *
 * @module lib/lead-capture/snippets
 */

/** The standalone hosted form URL. */
export function buildHostedUrl(origin: string, token: string): string {
  return `${origin}/lead/${token}`;
}

/** An iframe embed that renders the chromeless form variant. */
export function buildIframeSnippet(origin: string, token: string): string {
  return `<iframe src="${origin}/lead/${token}?embed=1" title="Enquiry form" style="width:100%;border:0;min-height:640px" loading="lazy"></iframe>`;
}

/** A script snippet: the loader injects the iframe and auto-resizes it. */
export function buildScriptSnippet(origin: string, token: string): string {
  return `<script src="${origin}/lead-embed.js" data-zebri-form="${token}" async></script>`;
}
