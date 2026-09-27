/**
 * The text/plain alternative for an outgoing email, derived from its
 * rendered HTML.
 *
 * Every send gets its text part here, inside `dispatchEmail`, from the
 * exact HTML that goes out. Deriving it from the final HTML (rather than
 * from the TipTap document the body started as) is deliberate:
 *
 * - The HTML is the only form that has the variables resolved. The
 *   document's `docToText` writes a mention back as its `{{token}}`, which
 *   is what the builder needs and never what a couple should read.
 * - The HTML already carries the legal footer: the sender identity, the
 *   ABN / phone / postal address, and this recipient's unsubscribe link.
 *   A text part built any other way would have to rebuild that footer and
 *   could drift from it, and a text part without the unsubscribe URL
 *   reopens the Spam Act gap for every text-only reader.
 *
 * A link is written as `label (url)`, so the unsubscribe link reads
 * "Unsubscribe (https://...) from these emails" and still works when
 * nothing is clickable.
 *
 * Pure string work, no DOM: it runs on the server for every send. It is
 * not a general HTML parser and does not need to be: its input is our
 * own sanitised templates and shells.
 *
 * @module lib/email/html-to-text
 */

/** Named entities our renderers and the sanitiser actually emit. */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  middot: '\u00b7',
  hellip: '\u2026',
  ndash: '\u2013',
  mdash: '\u2014',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201c',
  rdquo: '\u201d',
  copy: '\u00a9',
  bull: '\u2022',
  reg: '\u00ae',
  trade: '\u2122',
  deg: '\u00b0',
  times: '\u00d7',
  euro: '\u20ac',
  pound: '\u00a3',
  yen: '\u00a5',
  cent: '\u00a2',
  aacute: '\u00e1',
  agrave: '\u00e0',
  acirc: '\u00e2',
  auml: '\u00e4',
  eacute: '\u00e9',
  egrave: '\u00e8',
  ecirc: '\u00ea',
  euml: '\u00eb',
  iacute: '\u00ed',
  iuml: '\u00ef',
  oacute: '\u00f3',
  ocirc: '\u00f4',
  ouml: '\u00f6',
  uacute: '\u00fa',
  uuml: '\u00fc',
  ntilde: '\u00f1',
  ccedil: '\u00e7',
  szlig: '\u00df',
  // Zero-width and soft-hyphen entities decode to their characters and
  // are then removed with every other invisible one (see ZERO_WIDTH).
  zwnj: '\u200c',
  zwj: '\u200d',
  shy: '\u00ad',
};

/**
 * Invisible characters with no place in a text part: zero-width space,
 * non-joiner and joiner, word joiner, byte-order mark, soft hyphen.
 * Email preheader padding is made of these.
 */
const ZERO_WIDTH = /[\u200b-\u200d\u2060\ufeff\u00ad]/g;

/**
 * One HTML tag, with quoted attribute values allowed to hold `>`. A plain
 * `<[^>]*>` would stop at the `>` inside `title="a>b"` and leak the rest
 * of the tag into the text.
 */
const TAG = `(?:[^"'>]|"[^"]*"|'[^']*')*`;

/**
 * Attribute {@link htmlToText} matches on to find and strip the shell's
 * hidden preheader element (`preheaderHtml` in `./html`) as one unit,
 * before anything else sees it. Exported so `./html` renders the exact
 * same string this module looks for; the two must never drift apart, or
 * the preheader's inbox-preview sentence ends up duplicated in the
 * text/plain alternative.
 */
export const PREHEADER_MARKER_ATTR = 'data-zb-preheader';

/**
 * Decode HTML entities, named and numeric. Unknown names are left as written.
 *
 * Exported so `./html`'s preheader deriver can reuse the same entity
 * table when it flattens a rendered body to plain text, rather than
 * keeping a second copy that could drift from this one.
 */
export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      // A code point outside Unicode would throw in fromCodePoint.
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/**
 * Tags that start and end a line in the text version. `li` is not here:
 * its opening tag already starts a bulleted line, and ending it too would
 * put a blank line between every item.
 */
const BLOCK_TAGS = 'p|div|h[1-6]|tr|table|blockquote|section|header|footer|ul|ol|pre';

/**
 * Convert a rendered email's HTML into its plain-text alternative.
 *
 * @param html - The exact HTML being sent, footer included.
 * @returns Readable text: one line per block, a blank line between
 *   paragraphs, links as `label (url)`, never two blank lines in a row.
 */
export function htmlToText(html: string): string {
  let text = html
    // Nothing in the head is content, and a stylesheet or script body
    // would otherwise come out as text.
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<(style|script|title)[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // The preheader duplicates the start of the body on purpose (Task
    // 32): it exists only for the inbox-preview snippet, which never
    // reads the text/plain part. Removed whole (content and &zwnj;/nbsp
    // padding together) so it can never appear a second time here.
    .replace(new RegExp(`<div\\b[^>]*\\b${PREHEADER_MARKER_ATTR}\\b[^>]*>[\\s\\S]*?<\\/div\\s*>`, 'gi'), '');

  // Source whitespace, newlines included, is one space in HTML: only the
  // tags below make line breaks. (No template of ours uses <pre>.)
  text = text.replace(/\s+/g, ' ');

  // Links before the tag strip below loses the href. The href is read
  // as its own attribute, so a `data-href` beside it is not mistaken for it.
  text = text.replace(
    new RegExp(`<a\\b(${TAG})>([\\s\\S]*?)</a\\s*>`, 'gi'),
    (_whole, attrs: string, inner: string) => {
      const hrefMatch = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
      const href = decodeEntities(hrefMatch?.[1] ?? hrefMatch?.[2] ?? '').trim();
      const label = decodeEntities(inner.replace(new RegExp(`<${TAG}>`, 'g'), ''))
        .replace(ZERO_WIDTH, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!href || !/^(https?:|mailto:)/i.test(href)) return label;
      if (!label || label === href) return href;
      return `${label} (${href})`;
    },
  );

  // An ordered list numbers its items; any other item is a bullet.
  text = text.replace(new RegExp(`<ol\\b${TAG}>([\\s\\S]*?)</ol\\s*>`, 'gi'), (_whole, items: string) => {
    let n = 0;
    return `<ol>${items.replace(new RegExp(`<li\\b${TAG}>`, 'gi'), () => `\n${++n}. `)}</ol>`;
  });

  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(new RegExp(`<hr\\b${TAG}>`, 'gi'), '\n\n')
    .replace(new RegExp(`<li\\b${TAG}>`, 'gi'), '\n- ')
    // A paragraph ends in a blank line; any other block in a line end.
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(new RegExp(`</(${BLOCK_TAGS})\\s*>`, 'gi'), '\n')
    .replace(new RegExp(`<(${BLOCK_TAGS})\\b${TAG}>`, 'gi'), '\n')
    .replace(/<\/t[dh]\s*>/gi, ' ')
    .replace(new RegExp(`<${TAG}>`, 'g'), '');

  text = decodeEntities(text).replace(ZERO_WIDTH, '');

  return text
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
