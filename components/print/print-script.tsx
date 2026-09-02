'use client'

/**
 * Print a couple script: the rendered document, unbranded, in its own faces.
 *
 * A script is the performer's working copy, not a client document, so it
 * carries no logo header or brand colours, and nothing that is not the
 * script goes on the page: no frame, and the browser's own date / title /
 * URL / page-count header and footer are suppressed (`bare`). It goes
 * through the same `printDocument` shell as every other PDF so fonts and
 * print CSS come from one place.
 *
 * @module components/print/print-script
 */

import type { JSONContent } from '@tiptap/core'

import { renderScriptHtml } from '@/lib/documents/script-extensions'
import { collectScriptFonts, scriptFontsHref, scriptFontStack, type ScriptFontId } from '@/lib/documents/script-fonts'
import { printDocument } from '@/lib/pdf/print-document'

export interface PrintScriptInput {
  title: string
  content: JSONContent
  font: ScriptFontId
}

/** The printable script element: hook-free, safe HTML, script typography. */
export function scriptPrintElement({ title, content }: Omit<PrintScriptInput, 'font'>) {
  return <article className="script-document text-text" aria-label={title} dangerouslySetInnerHTML={{ __html: renderScriptHtml(content) }} />
}

/** Open the print window for a script and trigger print-to-PDF. */
export function printScript(input: PrintScriptInput): void {
  printDocument({
    title: input.title,
    element: scriptPrintElement(input),
    branding: null,
    canvas: false,
    frame: false,
    bare: true,
    fonts: {
      href: scriptFontsHref(collectScriptFonts(input.content, input.font)),
      bodyStack: scriptFontStack(input.font),
    },
  })
}
