'use client'

/**
 * Cmd/Ctrl+Shift+P toggles the template editor's Preview overlay
 * (`preview-overlay.tsx`, UX audit §3.7) from anywhere on the page - not
 * just while the header's Preview button has focus. Skips a real text
 * input/contenteditable target the same way `use-canvas-keys.ts` does, so
 * typing inside the template rename field never triggers it.
 *
 * @module features/proposals/editor/use-preview-shortcut
 */
import { useEffect, useRef } from 'react'

/** True for a native text input, textarea or contenteditable target, whose own typing must never be hijacked. */
function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return Boolean(el) && (el!.isContentEditable || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
}

/**
 * Binds Cmd/Ctrl+Shift+P on `window` for as long as this hook is mounted.
 *
 * `onToggle` is read through a ref, updated every render but never
 * re-listed as the listener effect's dependency, so the header re-passing
 * a fresh inline arrow each render does not unbind/rebind the window
 * listener - the same shape `components/ui/use-overlay.ts`'s `onCloseRef`
 * uses for its Escape handler.
 */
export function usePreviewShortcut(onToggle: () => void): void {
  const onToggleRef = useRef(onToggle)
  useEffect(() => {
    onToggleRef.current = onToggle
  }, [onToggle])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return
      if (e.key !== 'p' && e.key !== 'P') return
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      onToggleRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
