/**
 * Fetches raw HTML pages from the Commonwealth Register of Marriage Celebrants.
 *
 * The register is an ASP.NET WebForms app driving a Telerik RadGrid. Paging is
 * done via __doPostBack with __VIEWSTATE, not query params, so each page can
 * only be reached by posting the previous page's viewstate back to the server.
 * That makes the walk strictly sequential.
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = 'https://marriage.ag.gov.au/commonwealthcelebrants/all'
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** Delay between requests. Roughly matches a human clicking through the pager. */
const REQUEST_DELAY_MS = 1000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Decodes a response body as iso-8859-1.
 *
 * The register serves iso-8859-1, not UTF-8. Decoding as UTF-8 corrupts
 * accented names (e.g. O'Brién), so the charset is pinned explicitly.
 *
 * @param {Response} response
 * @returns {Promise<string>}
 */
async function decodeBody(response) {
  const buffer = await response.arrayBuffer()
  return new TextDecoder('iso-8859-1').decode(buffer)
}

/**
 * Reads an ASP.NET hidden form field out of a page's HTML.
 *
 * @param {string} html
 * @param {string} id - The input's id attribute, e.g. "__VIEWSTATE".
 * @returns {string} The field value, or an empty string if absent.
 */
function hiddenField(html, id) {
  const match = html.match(new RegExp(`id="${id}"[^>]*value="([^"]*)"`))
  return match ? match[1] : ''
}

/**
 * Reads the pager's current page number, used to verify the walk advanced.
 *
 * @param {string} html
 * @returns {number} The 1-based page number, or 0 if it could not be read.
 */
export function currentPage(html) {
  const match = html.match(/rgCurrentPage[^>]*>(?:<[^>]*>)*\s*(\d+)/)
  return match ? Number(match[1]) : 0
}

/**
 * Counts data rows on a page. Used to sanity-check each fetch.
 *
 * @param {string} html
 * @returns {number}
 */
export function countRows(html) {
  return (html.match(/class="rg(?:Row|AltRow)"/g) || []).length
}

/**
 * Finds the postback target of the pager's "next page" button.
 *
 * The button's control id is not stable: it is ctl28 on page 1 but ctl30 from
 * page 11 on, because Telerik adds pager buttons once "first"/"previous"
 * become active. Hardcoding an id silently stops advancing partway through.
 * The rgPageNext class is stable, so the target is read from the class instead.
 *
 * @param {string} html
 * @returns {string | null} The postback target, or null on the last page,
 *   where the button is rendered inert.
 */
export function nextPageTarget(html) {
  for (const match of html.matchAll(/<input[^>]*>/g)) {
    if (!match[0].includes('class="rgPageNext"')) continue
    // The final page renders the button with an onclick of "return false".
    if (match[0].includes('return false')) return null
    const name = match[0].match(/name="([^"]*)"/)
    return name ? name[1] : null
  }
  return null
}

/**
 * Posts back to advance the grid to the next page.
 *
 * @param {string} html - The current page's HTML, source of the viewstate.
 * @param {string} target - The next button's postback target.
 * @returns {Promise<string>} The next page's HTML.
 */
async function fetchNextPage(html, target) {
  const body = new URLSearchParams({
    __EVENTTARGET: target,
    __EVENTARGUMENT: '',
    __VIEWSTATE: hiddenField(html, '__VIEWSTATE'),
    __VIEWSTATEGENERATOR: hiddenField(html, '__VIEWSTATEGENERATOR'),
    __EVENTVALIDATION: hiddenField(html, '__EVENTVALIDATION'),
  })
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: BASE_URL,
    },
    body,
  })
  if (!response.ok) throw new Error(`Postback failed: HTTP ${response.status}`)
  return decodeBody(response)
}

/**
 * Walks the register and caches each page's raw HTML to disk.
 *
 * Caching raw HTML decouples the expensive, rate-limited fetch from parsing,
 * so a parser fix can be re-run for free instead of re-scraping 217 pages.
 * Already-cached pages are reused, which also makes an interrupted run resumable.
 *
 * @param {object} options
 * @param {string} options.cacheDir - Directory to write page-NNN.html files into.
 * @param {number} [options.limit] - Stop after this many pages. Omit to fetch all.
 * @param {(message: string) => void} [options.log]
 * @returns {Promise<string[]>} Absolute paths of the cached pages, in order.
 */
export async function fetchAllPages({ cacheDir, limit, log = () => {} }) {
  await mkdir(cacheDir, { recursive: true })

  const pagePath = (n) => join(cacheDir, `page-${String(n).padStart(3, '0')}.html`)
  const paths = []
  let html = ''
  let page = 1

  while (true) {
    const path = pagePath(page)

    if (existsSync(path)) {
      html = await readFile(path, 'utf8')
      log(`page ${page}: cached (${countRows(html)} rows)`)
    } else {
      if (page === 1) {
        const response = await fetch(BASE_URL, { headers: { 'User-Agent': USER_AGENT } })
        if (!response.ok) throw new Error(`Initial fetch failed: HTTP ${response.status}`)
        html = await decodeBody(response)
      } else {
        const target = nextPageTarget(html)
        if (!target) throw new Error(`No next-page button found on page ${page - 1}`)
        html = await fetchNextPage(html, target)
      }

      // A stale or rejected viewstate makes the server silently re-serve the
      // page we were already on. Without this check the walk would loop and
      // write hundreds of duplicate pages that look superficially valid.
      const reported = currentPage(html)
      if (reported !== page) {
        throw new Error(`Expected page ${page} but the grid reported page ${reported}`)
      }

      await writeFile(path, html, 'utf8')
      log(`page ${page}: fetched (${countRows(html)} rows)`)
      await sleep(REQUEST_DELAY_MS)
    }

    paths.push(path)

    // The pager itself states when there is nowhere further to go, which is
    // more reliable than inferring the end from a short page.
    if (!nextPageTarget(html)) {
      log(`page ${page} is the last page (${countRows(html)} rows)`)
      break
    }
    if (limit && page >= limit) break
    page += 1
  }

  return paths
}
