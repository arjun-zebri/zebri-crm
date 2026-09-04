/**
 * Making a user-agent string readable on the certificate.
 *
 * A raw UA string is noise to the audience the certificate is written for.
 * Redaction is not the goal here (unlike an IP, a UA is not a unique
 * identifier); legibility is. So this is presentation, done in TypeScript,
 * while the IP prefixing that IS a privacy boundary happens in SQL.
 *
 * @module lib/contracts/user-agent
 */

const BROWSERS: Array<[RegExp, string]> = [
  // Order matters: Edge and Chrome both claim "Chrome", Chrome claims "Safari".
  [/Edg[eA-Z]?\/(\d+)/, 'Edge'],
  [/OPR\/(\d+)/, 'Opera'],
  [/Firefox\/(\d+)/, 'Firefox'],
  [/Chrome\/(\d+)/, 'Chrome'],
  [/Version\/(\d+).*Safari/, 'Safari'],
]

const PLATFORMS: Array<[RegExp, string]> = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Windows/, 'Windows'],
  [/Linux/, 'Linux'],
]

/**
 * "Chrome 141 on macOS", or a graceful fallback.
 *
 * @param ua - The raw user-agent string, possibly empty or unrecognised.
 */
export function describeUserAgent(ua: string | null | undefined): string | null {
  if (!ua || ua.trim() === '') return null

  let browser: string | null = null
  for (const [re, name] of BROWSERS) {
    const m = re.exec(ua)
    if (m) {
      browser = m[1] ? `${name} ${m[1]}` : name
      break
    }
  }

  let platform: string | null = null
  for (const [re, name] of PLATFORMS) {
    if (re.test(ua)) {
      platform = name
      break
    }
  }

  if (browser && platform) return `${browser} on ${platform}`
  if (browser) return browser
  if (platform) return platform
  // Unrecognised: say nothing rather than print a wall of tokens.
  return null
}
