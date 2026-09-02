'use client'

/**
 * Load the Google Fonts stylesheet for a script's faces.
 *
 * One `<link data-script-fonts>` in `document.head`, replaced when the set of
 * faces changes. Kept (not removed on unmount) so switching between the
 * editor and the perform overlay never flashes the fallback face.
 *
 * @module components/documents/use-script-fonts
 */
import { useEffect } from 'react'

import { scriptFontsHref, type ScriptFontId } from '@/lib/documents/script-fonts'

const LINK_ATTR = 'data-script-fonts'

/** Mount (or update) the script fonts stylesheet for the given faces. */
export function useScriptFonts(fonts: readonly ScriptFontId[]): void {
  const href = scriptFontsHref(fonts)
  useEffect(() => {
    if (typeof document === 'undefined') return
    let link = document.head.querySelector<HTMLLinkElement>(`link[${LINK_ATTR}]`)
    if (!link) {
      link = document.createElement('link')
      link.rel = 'stylesheet'
      link.setAttribute(LINK_ATTR, '')
      document.head.appendChild(link)
    }
    if (link.href !== href) link.href = href
  }, [href])
}
