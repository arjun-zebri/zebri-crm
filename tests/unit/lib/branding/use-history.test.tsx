import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useHistory } from '@/lib/branding/use-history'

/** Fire a keydown at `target` and let it bubble to the window handler. */
function press(target: HTMLElement, key: string, init: KeyboardEventInit = {}) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, metaKey: true, bubbles: true, cancelable: true, ...init }))
}

describe('useHistory keyboard undo', () => {
  it('undoes canvas-wide from a plain contenteditable', () => {
    const { result } = renderHook(() => useHistory({ n: 0 }))
    act(() => { result.current.set({ n: 1 }, { commit: true }) })
    act(() => { result.current.commit() })
    const field = document.createElement('div')
    field.contentEditable = 'true'
    document.body.appendChild(field)
    act(() => { press(field, 'z') })
    expect(result.current.state).toEqual({ n: 0 })
    field.remove()
  })

  it('leaves cmd+z inside a ProseMirror field to the editor', () => {
    // TipTap carries its own history: taking the shortcut here too undid
    // twice, blurred the field, and left the next Backspace deleting the
    // whole selected block instead of a character.
    const { result } = renderHook(() => useHistory({ n: 0 }))
    act(() => { result.current.set({ n: 1 }, { commit: true }) })
    act(() => { result.current.commit() })
    const editor = document.createElement('div')
    editor.className = 'ProseMirror'
    editor.contentEditable = 'true'
    // jsdom does not make contenteditable focusable on its own.
    editor.tabIndex = -1
    const inner = document.createElement('p')
    editor.appendChild(inner)
    document.body.appendChild(editor)
    editor.focus()
    act(() => { press(inner, 'z') })
    expect(result.current.state).toEqual({ n: 1 })
    expect(document.activeElement).toBe(editor)
    editor.remove()
  })
})
