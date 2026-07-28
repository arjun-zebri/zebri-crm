/**
 * Finds Instagram handles for celebrants who have no website, via Google search.
 *
 * Only celebrants whose email local part looks like a business name are tried
 * ("wildheartcelebrations@gmail.com"). The handle is accepted only when it
 * matches that local part, which is corroboration from a second, independent
 * source: the register says the business name, Instagram says the handle.
 *
 * A search that merely returns a plausible profile is NOT enough. Piloting
 * "adamkingcelebrant" surfaced a wedding photographer named Adam King, and
 * "bramblecelebrant" surfaced a different celebrant in New Zealand. Taking the
 * top result would have written both into the wrong person's row.
 *
 * Setup (free tier, no credit card, 100 queries/day). The API key comes from the
 * Cloud Console; the docs page has no "get a key" button:
 *   1. Search engine (gives GOOGLE_CSE_CX):
 *      https://programmablesearchengine.google.com/controlpanel/create
 *      Set "Search the entire web" on, then copy the Search engine ID.
 *   2. Enable the API on a Cloud project:
 *      https://console.cloud.google.com/apis/library/customsearch.googleapis.com
 *   3. Create the key (gives GOOGLE_CSE_KEY):
 *      https://console.cloud.google.com/apis/credentials -> Create credentials -> API key
 *   4. export GOOGLE_CSE_KEY=... GOOGLE_CSE_CX=...
 *
 * Usage:
 *   node scripts/celebrants/search-instagram.mjs            # up to 100 queries
 *   node scripts/celebrants/search-instagram.mjs --max 20   # smaller batch
 *
 * Run it once a day; it resumes from cache and stops when the quota is spent.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { toCsv, COLUMNS } from './to-csv.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, 'out')
const CACHE_FILE = join(HERE, '.cache', 'search.json')

/** Google's free tier allows 100 queries per day. */
const DEFAULT_MAX = 100

/** Delay between queries. Google's free tier is not rate-limited hard, but this stays courteous. */
const DELAY_MS = 500

/** Marks an email local part as a trading name rather than a person's name. */
const BUSINESS_WORDS =
  /celebrant|ceremon|wedding|marry|marri|vows|nuptial|knot|hitch|bride|love|union/i

/**
 * Shortest local part worth trusting a normalised match on. Below this, a
 * separator-insensitive comparison starts matching generic words by accident.
 */
const MIN_LOCAL_LENGTH = 8

/**
 * Parses CSV text into row objects. The file is written by this project, so
 * only the quoting shapes toCsv emits need handling.
 *
 * @param {string} text
 * @returns {Array<Record<string, string>>}
 */
function fromCsv(text) {
  const rows = []
  const lines = text.split('\n').filter(Boolean)
  const header = lines[0].split(',')

  for (const line of lines.slice(1)) {
    const values = []
    let current = ''
    let quoted = false
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i]
      if (quoted) {
        if (char === '"' && line[i + 1] === '"') { current += '"'; i += 1 }
        else if (char === '"') quoted = false
        else current += char
      } else if (char === '"') quoted = true
      else if (char === ',') { values.push(current); current = '' }
      else current += char
    }
    values.push(current)
    rows.push(Object.fromEntries(header.map((key, i) => [key, values[i] ?? ''])))
  }
  return rows
}

/**
 * Strips separators so "megan_boyd_celebrant" and "meganboyd.celebrant" compare
 * equal. The token sequence still has to match exactly.
 *
 * @param {string} value
 * @returns {string}
 */
function normalise(value) {
  return value.toLowerCase().replace(/[._\-\s]/g, '')
}

/**
 * Reads a numeric CLI flag.
 *
 * @param {string[]} argv
 * @param {string} flag
 * @param {number} fallback
 * @returns {number}
 */
function numericFlag(argv, flag, fallback) {
  const index = argv.indexOf(flag)
  if (index === -1) return fallback
  const value = Number(argv[index + 1])
  if (!Number.isInteger(value) || value < 1) throw new Error(`${flag} needs a positive integer`)
  return value
}

/**
 * Runs one Google Custom Search query restricted to Instagram.
 *
 * @param {string} local - The email local part being searched for.
 * @param {string} key
 * @param {string} cx
 * @returns {Promise<{handle: string, matched: boolean, quotaExhausted: boolean}>}
 */
async function searchOne(local, key, cx) {
  const query = `"${local}" site:instagram.com`
  const url =
    `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}` +
    `&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&num=10`

  const response = await fetch(url)
  if (response.status === 429) return { handle: '', matched: false, quotaExhausted: true }
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Search failed (HTTP ${response.status}): ${detail.slice(0, 200)}`)
  }

  const body = await response.json()
  const target = normalise(local)

  for (const item of body.items || []) {
    const found = String(item.link || '').match(/instagram\.com\/([A-Za-z0-9_.]+)/i)
    if (!found) continue
    const handle = found[1].replace(/\/$/, '')
    // The corroboration test: the handle must be the business name the
    // register already told us, not merely a profile that looks relevant.
    if (normalise(handle) === target) return { handle, matched: true, quotaExhausted: false }
  }
  return { handle: '', matched: false, quotaExhausted: false }
}

/**
 * Selects celebrants worth searching for.
 *
 * @param {Array<Record<string, string>>} rows
 * @returns {string[]} Distinct email local parts.
 */
function searchable(rows) {
  const locals = new Set()
  for (const row of rows) {
    if (row.instagram) continue
    const local = (row.email.split('@')[0] || '').trim()
    if (local.length < MIN_LOCAL_LENGTH) continue
    if (!BUSINESS_WORDS.test(local)) continue
    locals.add(local)
  }
  return [...locals]
}

async function main() {
  const argv = process.argv.slice(2)
  const max = numericFlag(argv, '--max', DEFAULT_MAX)
  const dryRun = argv.includes('--dry-run')
  const key = process.env.GOOGLE_CSE_KEY
  const cx = process.env.GOOGLE_CSE_CX
  if (!dryRun && (!key || !cx)) {
    throw new Error('Set GOOGLE_CSE_KEY and GOOGLE_CSE_CX (see the header of this file)')
  }

  const inputFile = join(OUT_DIR, 'celebrants-enriched.csv')
  if (!existsSync(inputFile)) throw new Error(`Missing ${inputFile}; run enrich.mjs first`)
  const rows = fromCsv(await readFile(inputFile, 'utf8'))

  const cache = existsSync(CACHE_FILE) ? JSON.parse(await readFile(CACHE_FILE, 'utf8')) : {}
  const all = searchable(rows)
  const pending = all.filter((local) => !(local in cache))
  const batch = pending.slice(0, max)

  console.log(`${all.length} searchable celebrants, ${all.length - pending.length} already checked`)
  console.log(`Querying ${dryRun ? 0 : batch.length} this run${dryRun ? ' (dry run)' : ''}\n`)

  if (dryRun) {
    console.log(`Would query ${batch.length} now, ${pending.length} pending overall`)
    console.log(`At ${DEFAULT_MAX}/day that is ${Math.ceil(pending.length / DEFAULT_MAX)} daily runs\n`)
    console.log('First 10 queries that would run:')
    for (const local of batch.slice(0, 10)) console.log(`  "${local}" site:instagram.com`)
    return
  }

  let hits = 0
  let stopped = false
  for (const [index, local] of batch.entries()) {
    const result = await searchOne(local, key, cx)
    if (result.quotaExhausted) {
      console.log(`\nDaily quota reached after ${index} queries. Re-run tomorrow to continue.`)
      stopped = true
      break
    }
    cache[local] = { handle: result.handle, matched: result.matched }
    if (result.matched) {
      hits += 1
      console.log(`  ${local} -> @${result.handle}`)
    }
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
  }

  await mkdir(dirname(CACHE_FILE), { recursive: true })
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8')

  const final = rows.map((row) => {
    const local = (row.email.split('@')[0] || '').trim()
    const found = !row.instagram && cache[local]?.matched ? cache[local].handle : ''
    return {
      ...row,
      instagram: row.instagram || found,
      instagram_source: row.instagram ? 'website' : found ? 'search' : '',
    }
  })

  const columns = [...COLUMNS, 'website', 'business_name', 'instagram', 'facebook', 'instagram_source']
  const outFile = join(OUT_DIR, 'celebrants-final.csv')
  await writeFile(outFile, toCsv(final, columns), 'utf8')

  const checked = all.filter((l) => l in cache).length
  const matched = all.filter((l) => cache[l]?.matched).length
  console.log(`\nSearched so far   ${checked}/${all.length}`)
  console.log(`Handles matched   ${matched} (${checked ? Math.round((matched / checked) * 100) : 0}% of searched)`)
  console.log(`Instagram total   ${final.filter((r) => r.instagram).length}`)
  console.log(`\nWrote ${final.length} rows to ${outFile}`)
  if (!stopped && pending.length > batch.length) {
    console.log(`${pending.length - batch.length} still to search; re-run tomorrow.`)
  }
}

main().catch((error) => {
  console.error(`\nFailed: ${error.message}`)
  process.exit(1)
})
