/**
 * YouTube / Vimeo URL parsing for proposal video embeds (D14, spec §7.4).
 * Pure: a share URL in, a provider + id out, then a privacy-enhanced iframe
 * `src` (youtube-nocookie.com, Vimeo `dnt=1`). Any other host is rejected,
 * so the public page never embeds an arbitrary origin.
 *
 * @module lib/proposals/embed-url
 */

/** The two video hosts a proposal can embed. */
export type EmbedProvider = 'youtube' | 'vimeo';

/** A share URL resolved to its provider and video id. */
export interface ParsedEmbed {
  provider: EmbedProvider;
  id: string;
}

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com', 'youtube-nocookie.com']);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;

/**
 * Parse a pasted URL into a provider + video id, or null when it is not a
 * YouTube / Vimeo video URL. Tolerates a missing scheme (`vimeo.com/123`).
 */
export function parseEmbedUrl(input: string): ParsedEmbed | null {
  const raw = input.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);

  if (YOUTUBE_HOSTS.has(host)) {
    const candidate =
      host === 'youtu.be'
        ? segments[0]
        : segments[0] === 'embed' || segments[0] === 'shorts' || segments[0] === 'v'
          ? segments[1]
          : url.searchParams.get('v');
    return candidate && YT_ID.test(candidate) ? { provider: 'youtube', id: candidate } : null;
  }
  if (VIMEO_HOSTS.has(host)) {
    // The id is the last numeric path segment: vimeo.com/ID, /video/ID, /channels/x/ID.
    const candidate = [...segments].reverse().find((s) => VIMEO_ID.test(s));
    return candidate ? { provider: 'vimeo', id: candidate } : null;
  }
  return null;
}

/**
 * The iframe `src` for a parsed embed. `background` (hero use) autoplays
 * muted and looped with no controls; YouTube needs `playlist=<id>` for loop.
 */
export function embedIframeSrc(parsed: ParsedEmbed, opts: { background?: boolean } = {}): string {
  if (parsed.provider === 'youtube') {
    const base = `https://www.youtube-nocookie.com/embed/${parsed.id}?rel=0&modestbranding=1`;
    return opts.background ? `${base}&autoplay=1&mute=1&loop=1&controls=0&playsinline=1&playlist=${parsed.id}` : base;
  }
  const base = `https://player.vimeo.com/video/${parsed.id}?dnt=1`;
  return opts.background ? `${base}&background=1&autoplay=1&muted=1&loop=1` : base;
}
