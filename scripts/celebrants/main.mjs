/**
 * Scrapes the Commonwealth Register of Marriage Celebrants into a CSV.
 *
 * Usage:
 *   node scripts/celebrants/main.mjs                # full run, all pages
 *   node scripts/celebrants/main.mjs --limit 3      # first 3 pages only
 *   node scripts/celebrants/main.mjs --parse-only   # re-parse the cache, no requests
 *   node scripts/celebrants/main.mjs --refresh      # ignore the cache and refetch
 *
 * Output and cache are gitignored: this is ~10,000 people's personal contact
 * details and must not enter git history.
 */

import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchAllPages } from './fetch-pages.mjs'
import { parsePage } from './parse-page.mjs'
import { toCsv } from './to-csv.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(HERE, '.cache')
const OUT_DIR = join(HERE, 'out')

/** Rows the register serves per page. The page-size cap cannot be raised. */
const ROWS_PER_PAGE = 50

/**
 * Reads a numeric CLI flag.
 *
 * @param {string[]} argv
 * @param {string} flag
 * @returns {number | undefined}
 */
function numericFlag(argv, flag) {
  const index = argv.indexOf(flag)
  if (index === -1) return undefined
  const value = Number(argv[index + 1])
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${flag} needs a positive integer`)
  }
  return value
}

/**
 * Parses cached pages into rows, in page order.
 *
 * @param {string} cacheDir
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function parseCache(cacheDir) {
  const files = (await readdir(cacheDir)).filter((f) => f.endsWith('.html')).sort()
  const rows = []
  for (const file of files) {
    const pageNumber = Number(file.match(/(\d+)/)[1])
    const html = await readFile(join(cacheDir, file), 'utf8')
    rows.push(...parsePage(html, pageNumber))
  }
  return rows
}

/**
 * Reports data-quality signals and fails on the errors that matter.
 *
 * The dangerous failure is a silent short scrape, where a rejected viewstate
 * yields a plausible-looking file that is quietly missing thousands of people.
 * A page that is short without being the last page is the signal for that.
 *
 * @param {Array<Record<string, unknown>>} rows
 * @param {number} pageCount
 * @param {boolean} partial - True when --limit capped the run.
 */
function verify(rows, pageCount, partial) {
  const byPage = new Map()
  for (const row of rows) byPage.set(row.source_page, (byPage.get(row.source_page) || 0) + 1)

  const short = [...byPage.entries()]
    .filter(([page, count]) => count < ROWS_PER_PAGE && page !== pageCount)
    .map(([page, count]) => `page ${page} has ${count} rows`)
  if (short.length) throw new Error(`Incomplete pages detected: ${short.join(', ')}`)

  const withEmail = rows.filter((r) => r.email).length
  const withPhone = rows.filter((r) => r.mobile || r.phone_home || r.phone_work).length
  const withState = rows.filter((r) => r.state).length
  const unique = new Set(rows.map((r) => `${r.surname}|${r.given_names}|${r.registration_date}`))
  const percent = (n) => `${Math.round((n / rows.length) * 100)}%`

  console.log(`\nPages parsed     ${pageCount}${partial ? ' (limited run)' : ''}`)
  console.log(`Celebrants       ${rows.length}`)
  console.log(`Distinct people  ${unique.size}`)
  console.log(`With email       ${withEmail} (${percent(withEmail)})`)
  console.log(`With any phone   ${withPhone} (${percent(withPhone)})`)
  console.log(`With state       ${withState} (${percent(withState)})`)
}

async function main() {
  const argv = process.argv.slice(2)
  const limit = numericFlag(argv, '--limit')
  const parseOnly = argv.includes('--parse-only')

  if (argv.includes('--refresh') && existsSync(CACHE_DIR)) {
    await rm(CACHE_DIR, { recursive: true })
  }

  if (!parseOnly) {
    await fetchAllPages({ cacheDir: CACHE_DIR, limit, log: (m) => console.log(m) })
  } else if (!existsSync(CACHE_DIR)) {
    throw new Error('--parse-only needs a populated cache; run a fetch first')
  }

  const rows = await parseCache(CACHE_DIR)
  const pageCount = new Set(rows.map((r) => r.source_page)).size
  verify(rows, pageCount, Boolean(limit))

  await mkdir(OUT_DIR, { recursive: true })
  const outFile = join(OUT_DIR, 'celebrants.csv')
  await writeFile(outFile, toCsv(rows), 'utf8')
  console.log(`\nWrote ${rows.length} rows to ${outFile}`)
}

main().catch((error) => {
  console.error(`\nFailed: ${error.message}`)
  process.exit(1)
})
