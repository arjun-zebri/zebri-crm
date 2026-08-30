/**
 * Turns a raw user-agent string into something a human can read in a ticket.
 *
 * Deliberately crude. A full UA-parsing dependency would be a lot of weight to
 * carry so that a bug ticket can say "Chrome on macOS" instead of a 130-char
 * string nobody reads. When the guess fails we fall back to the raw string,
 * which is still the truth, just uglier.
 *
 * @module lib/bug-reports/user-agent
 */

/** Ordered browser probes. First match wins, so Edge and Chrome precede Safari. */
const BROWSERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Edg\/([\d.]+)/, 'Edge'],
  [/OPR\/([\d.]+)/, 'Opera'],
  [/Firefox\/([\d.]+)/, 'Firefox'],
  [/Chrome\/([\d.]+)/, 'Chrome'],
  [/Version\/([\d.]+).*Safari/, 'Safari'],
];

/** Ordered OS probes. iPadOS reports as Mac, so iPad is checked first. */
const PLATFORMS: ReadonlyArray<readonly [RegExp, string]> = [
  [/iPad/, 'iPadOS'],
  [/iPhone|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Mac OS X/, 'macOS'],
  [/Windows NT/, 'Windows'],
  [/Linux/, 'Linux'],
];

/**
 * Summarises a user agent as "Chrome 141 on macOS".
 *
 * @param userAgent - The raw `user-agent` header, or null when absent.
 * @returns A short human-readable summary, or the raw string if unrecognised.
 */
export function summariseUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'unknown';

  let browser = '';
  for (const [pattern, name] of BROWSERS) {
    const match = pattern.exec(userAgent);
    if (match) {
      // Major version only. The patch number is noise in a ticket.
      const major = match[1]?.split('.')[0];
      browser = major ? `${name} ${major}` : name;
      break;
    }
  }

  let platform = '';
  for (const [pattern, name] of PLATFORMS) {
    if (pattern.test(userAgent)) {
      platform = name;
      break;
    }
  }

  if (browser && platform) return `${browser} on ${platform}`;
  if (browser) return browser;
  if (platform) return platform;
  return userAgent;
}
