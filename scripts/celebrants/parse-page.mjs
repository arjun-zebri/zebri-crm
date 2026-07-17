/**
 * Parses a Commonwealth celebrant register page into structured rows.
 *
 * Pure string in, objects out. No network or disk access, so a parser change
 * can be re-run against cached HTML without touching the register.
 */

/** States used to recognise a "SUBURB STATE POSTCODE" locality line. */
const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']

/**
 * @typedef {object} Celebrant
 * @property {string} surname
 * @property {string} given_names
 * @property {string} title
 * @property {string} state - From the grid's group header. Empty when the celebrant publishes no address.
 * @property {string} status - Registration status, e.g. "Registered".
 * @property {string} registration_date - ISO 8601 (yyyy-mm-dd), or empty.
 * @property {string} sub_status - e.g. "Active".
 * @property {string} street
 * @property {string} suburb
 * @property {string} postcode
 * @property {string} phone_home
 * @property {string} phone_work
 * @property {string} mobile
 * @property {string} email
 * @property {string} ceremony_types
 * @property {number} source_page
 */

/**
 * Decodes the HTML entities the register actually emits.
 *
 * @param {string} value
 * @returns {string}
 */
function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

/**
 * Strips tags from an HTML fragment and collapses whitespace.
 *
 * @param {string} html
 * @returns {string}
 */
function text(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/**
 * Splits a table cell into its <br>-separated visual lines.
 *
 * The register emits invalid `</br>` closing tags as line breaks alongside
 * ordinary `<br/>`, so both spellings have to be treated as separators.
 *
 * @param {string} html
 * @returns {string[]} Non-empty lines.
 */
function lines(html) {
  return html
    .split(/<\/?br\s*\/?>/i)
    .map(text)
    .filter(Boolean)
}

/**
 * Converts the register's d/mm/yyyy dates to ISO 8601 for sortable output.
 *
 * @param {string} value
 * @returns {string} yyyy-mm-dd, or an empty string if unparseable.
 */
function toIsoDate(value) {
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!match) return ''
  const [, day, month, year] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

/**
 * Parses the name cell: celebrant name, status, registration date, sub-status.
 *
 * @param {string} cell
 * @returns {Pick<Celebrant, 'surname'|'given_names'|'title'|'status'|'registration_date'|'sub_status'>}
 */
function parseNameCell(cell) {
  const nameMatch = cell.match(/lblCelebrant[^>]*>\s*<b>([^<]*)<\/b>([^<]*)/)
  const surname = nameMatch ? decodeEntities(nameMatch[1]).trim() : ''
  const remainder = nameMatch ? decodeEntities(nameMatch[2]).trim() : ''

  // Renders as "Given, Title", but the title is often absent, leaving a
  // trailing comma. Splitting on the last comma handles both shapes.
  const comma = remainder.lastIndexOf(',')
  const given_names = (comma === -1 ? remainder : remainder.slice(0, comma)).trim()
  const title = (comma === -1 ? '' : remainder.slice(comma + 1)).trim()

  const status = cell.match(/gridview_status[^>]*>([^<]*)/)
  const subStatus = cell.match(/gridview_substatus[^>]*>([^<]*)/)
  const date = cell.match(/gridview_smalltext[^>]*>\s*<b>([^<]*)<\/b>/)

  return {
    surname,
    given_names,
    title,
    status: status ? text(status[1]) : '',
    registration_date: date ? toIsoDate(date[1]) : '',
    sub_status: subStatus ? text(subStatus[1]) : '',
  }
}

/**
 * Parses the address cell: street, locality, phones, email, ceremony types.
 *
 * Every field here is optional and they disappear independently, so each is
 * matched on its own marker rather than by position.
 *
 * @param {string} cell
 * @returns {Pick<Celebrant, 'street'|'suburb'|'postcode'|'phone_home'|'phone_work'|'mobile'|'email'|'ceremony_types'>}
 */
function parseAddressCell(cell) {
  const flat = text(cell)

  // Numbers are published in mixed shapes, e.g. "(02) 62822202", "0415 633 429".
  // The class stops at the first letter, which is where the next label or the
  // email begins.
  const number = '([\\d()+\\-. ]+)'
  const email = flat.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
  const phoneHome = flat.match(new RegExp(`p\\(H\\):\\s*${number}`, 'i'))
  const phoneWork = flat.match(new RegExp(`p\\(W\\):\\s*${number}`, 'i'))
  const mobile = flat.match(new RegExp(`\\bm:\\s*${number}`, 'i'))

  // Bold marks both ceremony types and the contact labels ("p(H):", "m:").
  // Labels are the ones ending in a colon, so dropping those leaves the types.
  const ceremonies = [...cell.matchAll(/<b>([^<]*)<\/b>/g)]
    .map((match) => text(match[1]))
    .filter((value) => value && !value.endsWith(':'))

  const localityPattern = new RegExp(`^(.*?)\\s+(${STATES.join('|')})\\s+(\\d{4})$`)
  const parts = lines(cell)
  let suburb = ''
  let postcode = ''
  let localityIndex = -1

  parts.forEach((line, index) => {
    const match = line.match(localityPattern)
    if (match && localityIndex === -1) {
      suburb = match[1].trim()
      postcode = match[3]
      localityIndex = index
    }
  })

  // Anything before the locality line is the street address. When no locality
  // is published there is no reliable way to tell a street from a contact
  // line, so street is left empty rather than guessed at.
  const street =
    localityIndex > 0 ? parts.slice(0, localityIndex).join(', ') : ''

  return {
    street,
    suburb,
    postcode,
    phone_home: phoneHome ? phoneHome[1].trim() : '',
    phone_work: phoneWork ? phoneWork[1].trim() : '',
    mobile: mobile ? mobile[1].trim() : '',
    email: email ? email[0] : '',
    ceremony_types: ceremonies.join('; '),
  }
}

/**
 * Parses one cached register page into celebrant rows.
 *
 * Rows and group headers are walked in document order because the grid states
 * a row's state only in the nearest preceding group header. A blank header is
 * meaningful: it marks celebrants who publish no address, so their state is
 * genuinely unknown rather than missing through a parse failure.
 *
 * @param {string} html - Raw page HTML.
 * @param {number} pageNumber - Recorded on each row for provenance.
 * @returns {Celebrant[]}
 */
export function parsePage(html, pageNumber) {
  const rowPattern = /<tr class="rg(GroupHeader|Row|AltRow)"[\s\S]*?<\/tr>/g
  const celebrants = []
  let state = ''
  let match

  while ((match = rowPattern.exec(html)) !== null) {
    if (match[1] === 'GroupHeader') {
      const group = match[0].match(/grpState">([^<]*)</)
      state = group ? text(group[1]) : ''
      continue
    }

    const cells = match[0].match(/<td[\s\S]*?<\/td>/g) || []
    // Cell 0 is the grouping gutter; 1 is the name block; 2 is the address block.
    if (cells.length < 3) continue

    const name = parseNameCell(cells[1])
    if (!name.surname) continue

    celebrants.push({
      ...name,
      state,
      ...parseAddressCell(cells[2]),
      source_page: pageNumber,
    })
  }

  return celebrants
}
