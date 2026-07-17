/**
 * Enriches the celebrant CSV with website, business name, and social handles.
 *
 * Usage:
 *   node scripts/celebrants/enrich.mjs --limit 30   # pilot a sample
 *   node scripts/celebrants/enrich.mjs              # all business domains
 *
 * Only celebrants with their own business domain can be enriched. Those on
 * gmail/hotmail have no derivable website, and are left blank rather than
 * guessed at.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { lookupSite } from './site-lookup.mjs'
import { toCsv, COLUMNS } from './to-csv.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, 'out')
const CACHE_FILE = join(HERE, '.cache', 'sites.json')

/** Consumer mail and ISP hosts. These are never a celebrant's own website. */
const PROVIDERS = new Set([
  'gmail.com', 'hotmail.com', 'hotmail.com.au', 'hotmail.co.uk', 'outlook.com',
  'outlook.com.au', 'live.com', 'live.com.au', 'yahoo.com', 'yahoo.com.au',
  'yahoo.co.uk', 'yahoo.co.nz', 'ymail.com', 'y7mail.com', 'icloud.com',
  'me.com', 'mac.com', 'msn.com', 'mail.com', 'protonmail.com', 'aol.com',
  'bigpond.com', 'bigpond.net.au', 'bigpond.com.au', 'optusnet.com.au',
  'iinet.net.au', 'internode.on.net', 'tpg.com.au', 'westnet.com.au',
  'aapt.net.au', 'ozemail.com.au', 'dodo.com.au', 'iprimus.com.au',
  'adam.com.au', 'exemail.com.au', 'activ8.net.au', 'bordernet.com.au',
  'ozonline.com.au', 'gmail.com.au', 'outlook.co.nz', 'xtra.co.nz',
  'yahoo.ca', 'yahoo.co.in', 'yahoo.fr', 'rocketmail.com', 'inbox.com',
  // ISPs and telcos that host member pages. Rare enough in the register to
  // pass the uniqueness test, but never a celebrant's own business site.
  'onthenet.com.au', 'aussiebb.com.au', 'telstra.com', 'telstra.com.au',
  'esc.net.au', 'nelsonbay.com', 'skymesh.com.au', 'aanet.com.au',
  'spin.net.au', 'harboursat.com.au', 'westvic.com.au', 'sctelco.net.au',
])

/** Simultaneous site fetches. Each hits a different host, so this stays polite. */
const CONCURRENCY = 6

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
  if (!Number.isInteger(value) || value < 1) throw new Error(`${flag} needs a positive integer`)
  return value
}

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
 * Picks the domains that plausibly belong to a celebrant's own business.
 *
 * A business domain is near-unique to its owner, so a host shared by several
 * celebrants is a mail provider or an employer rather than a personal site.
 *
 * @param {Array<Record<string, string>>} rows
 * @returns {Map<string, string>} Row email domain to candidate domain.
 */
function candidateDomains(rows) {
  const counts = new Map()
  for (const row of rows) {
    const domain = (row.email.split('@')[1] || '').toLowerCase().trim()
    if (domain) counts.set(domain, (counts.get(domain) || 0) + 1)
  }

  const candidates = new Map()
  for (const [domain, count] of counts) {
    if (PROVIDERS.has(domain)) continue
    if (count > 2) continue
    if (domain.endsWith('.gov.au') || domain.endsWith('.edu.au')) continue
    candidates.set(domain, domain)
  }
  return candidates
}

/**
 * Runs an async worker over items with a bounded number in flight.
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T) => Promise<R>} worker
 * @returns {Promise<R[]>}
 */
async function pool(items, limit, worker) {
  const results = new Array(items.length)
  let next = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await worker(items[index])
    }
  })
  await Promise.all(runners)
  return results
}

async function main() {
  const argv = process.argv.slice(2)
  const limit = numericFlag(argv, '--limit')

  const inputFile = join(OUT_DIR, 'celebrants.csv')
  if (!existsSync(inputFile)) throw new Error(`Missing ${inputFile}; run the scrape first`)
  const rows = fromCsv(await readFile(inputFile, 'utf8'))

  const candidateSet = candidateDomains(rows)
  const candidates = [...candidateSet.keys()]
  const targets = limit ? candidates.slice(0, limit) : candidates
  console.log(`${rows.length} celebrants, ${candidates.length} business domains`)
  console.log(`Looking up ${targets.length}${limit ? ' (pilot)' : ''} at ${CONCURRENCY} at a time\n`)

  // Cached lookups make re-runs and pilot-then-full-run free for anything
  // already fetched.
  const cache = existsSync(CACHE_FILE) ? JSON.parse(await readFile(CACHE_FILE, 'utf8')) : {}
  const pending = targets.filter((domain) => !cache[domain])

  let done = 0
  const results = await pool(pending, CONCURRENCY, async (domain) => {
    const result = await lookupSite(domain)
    done += 1
    if (done % 10 === 0) console.log(`  ${done}/${pending.length} looked up`)
    return result
  })
  for (const result of results) cache[result.domain] = result

  await mkdir(dirname(CACHE_FILE), { recursive: true })
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8')

  const enriched = rows.map((row) => {
    const domain = (row.email.split('@')[1] || '').toLowerCase().trim()
    // The cache outlives the candidate rules, so a domain demoted to a known
    // provider must not keep enriching rows from its stale entry.
    const site = candidateSet.has(domain) ? cache[domain] : undefined
    return {
      ...row,
      website: site?.website || '',
      business_name: site?.business_name || '',
      instagram: site?.instagram || '',
      facebook: site?.facebook || '',
    }
  })

  const looked = targets.map((d) => cache[d]).filter(Boolean)
  const reachable = looked.filter((s) => s.ok)
  const withIg = reachable.filter((s) => s.instagram)
  const withFb = reachable.filter((s) => s.facebook)
  const percent = (n, of) => (of ? `${Math.round((n / of) * 100)}%` : 'n/a')

  console.log(`\nDomains looked up   ${looked.length}`)
  console.log(`Site responded      ${reachable.length} (${percent(reachable.length, looked.length)})`)
  console.log(`Instagram found     ${withIg.length} (${percent(withIg.length, reachable.length)} of live sites)`)
  console.log(`Facebook found      ${withFb.length} (${percent(withFb.length, reachable.length)} of live sites)`)

  const outFile = join(OUT_DIR, 'celebrants-enriched.csv')
  const columns = [...COLUMNS, 'website', 'business_name', 'instagram', 'facebook']
  await writeFile(outFile, toCsv(enriched, columns), 'utf8')
  console.log(`\nWrote ${enriched.length} rows to ${outFile}`)
}

main().catch((error) => {
  console.error(`\nFailed: ${error.message}`)
  process.exit(1)
})
