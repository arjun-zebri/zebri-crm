/**
 * Looks up a celebrant's business website and reads the social links it publishes.
 *
 * Social handles are only ever taken from a link the celebrant put on their own
 * site. Nothing here guesses a handle from a person's name: a wrong guess would
 * attach a real stranger's profile to a real celebrant's record.
 */

/** Path segments that are Instagram features, not profile handles. */
const INSTAGRAM_RESERVED = new Set([
  'p', 'reel', 'reels', 'tv', 'stories', 'explore', 'accounts', 'about',
  'developer', 'legal', 'directory', 'instagram', 'privacy', 'terms', 'help',
])

/** Path segments that are Facebook features or share widgets, not pages. */
const FACEBOOK_RESERVED = new Set([
  'sharer', 'sharer.php', 'share.php', 'share', 'plugins', 'dialog', 'tr',
  'events', 'login.php', 'help', 'privacy', 'policies', 'terms', 'facebook',
  'profile.php', 'people', 'groups', 'hashtag', 'watch',
])

/**
 * Handles belonging to site builders, hosts, and other platforms.
 *
 * Templates link their own socials from the footer, so a naive "first social
 * link" read attributes Squarespace's or WordPress's account to the celebrant.
 */
const PLATFORM_HANDLES = new Set([
  'squarespace', 'wordpress', 'wordpresscom', 'wordpressdotcom', 'wix',
  'wixcom', 'godaddy', 'shopify', 'weebly', 'webflow', 'wordpressorg',
  'google', 'youtube', 'twitter', 'linkedin', 'pinterest', 'tiktok',
  'mailchimp', 'canva', 'vimeo', 'whatsapp', 'messenger', 'meta',
  'easyweddings', 'wedshed',
  // Registrars and ISPs. A parked or expired domain serves the host's own
  // page, so its socials belong to the host and not to the celebrant.
  'ventraip', 'webcentral', 'crazydomains', 'netregistry', 'digitalpacific',
  'panthur', 'melbourneit', 'zuver', 'hostopia', 'synergywholesale',
  'aussiebroadband', 'telstra', 'optus', 'vodafone', 'yahoo', 'onthenet_isp',
  'exetel', 'superloop', 'tpgtelecom', 'iinet',
])

/** Shortest plausible handle. Anything less is a parsing artefact, not a profile. */
const MIN_HANDLE_LENGTH = 3

/** Per-site request timeout. Celebrant sites are small; slow ones are dead ones. */
const TIMEOUT_MS = 10000

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * @typedef {object} SiteResult
 * @property {string} domain
 * @property {boolean} ok - True when the site responded with HTML.
 * @property {string} website - The final URL after redirects, or empty.
 * @property {string} business_name - The page title, trimmed.
 * @property {string} instagram - Profile handle without the @, or empty.
 * @property {string} facebook - Page slug, or empty.
 * @property {string} error - Short failure reason when ok is false.
 */

/**
 * Extracts a social handle from the first matching profile link on a page.
 *
 * @param {string} html
 * @param {RegExp} pattern - Must capture the handle in group 1.
 * @param {Set<string>} reserved - Non-profile path segments to skip.
 * @returns {string}
 */
function firstHandle(html, pattern, reserved) {
  for (const match of html.matchAll(pattern)) {
    const handle = match[1].replace(/\/$/, '').trim()
    const lower = handle.toLowerCase()
    if (!handle || reserved.has(lower)) continue
    if (PLATFORM_HANDLES.has(lower)) continue
    if (handle.length < MIN_HANDLE_LENGTH) continue
    // Bare tracking or numeric-only ids are not useful profile names.
    if (/^\d+$/.test(handle)) continue
    return handle
  }
  return ''
}

/**
 * Decodes HTML entities, including the numeric refs page titles are full of.
 *
 * @param {string} value
 * @returns {string}
 */
function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/**
 * Reads the page title, used as the celebrant's trading name.
 *
 * @param {string} html
 * @returns {string}
 */
function pageTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i)
  if (!match) return ''
  return decodeEntities(match[1].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/**
 * Extracts social links and title from a page's HTML.
 *
 * Exported separately from fetching so it can be reasoned about and re-run
 * against cached HTML without network access.
 *
 * @param {string} html
 * @returns {{business_name: string, instagram: string, facebook: string}}
 */
export function extractSocials(html) {
  // Numeric-id pages ("profile.php?id=123") carry their identity in the query
  // string, so the id is kept rather than discarded with the rest of the URL.
  const numericPage = html.match(/facebook\.com\/profile\.php\?id=(\d+)/i)
  const facebook =
    firstHandle(html, /facebook\.com\/(?:pages\/[^/]+\/)?([A-Za-z0-9_.\-]+)/gi, FACEBOOK_RESERVED) ||
    (numericPage ? `profile.php?id=${numericPage[1]}` : '')

  return {
    business_name: pageTitle(html),
    instagram: firstHandle(html, /instagram\.com\/([A-Za-z0-9_.]+)/gi, INSTAGRAM_RESERVED),
    facebook,
  }
}

/**
 * Fetches a domain's homepage and reads its socials.
 *
 * Tries https on the bare domain, then the www host, since celebrant sites are
 * inconsistent about which one answers. A dead domain is an expected outcome,
 * not an error worth failing the run over.
 *
 * @param {string} domain
 * @returns {Promise<SiteResult>}
 */
export async function lookupSite(domain) {
  const blank = { domain, ok: false, website: '', business_name: '', instagram: '', facebook: '' }

  for (const url of [`https://${domain}`, `https://www.${domain}`]) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
        redirect: 'follow',
        signal: controller.signal,
      })
      if (!response.ok) continue
      const type = response.headers.get('content-type') || ''
      if (!type.includes('html')) continue

      const html = await response.text()
      return { ...blank, ok: true, website: response.url, ...extractSocials(html), error: '' }
    } catch (error) {
      // Fall through to the next candidate host.
      blank.error = error.name === 'AbortError' ? 'timeout' : 'unreachable'
    } finally {
      clearTimeout(timer)
    }
  }

  return { ...blank, error: blank.error || 'no response' }
}
