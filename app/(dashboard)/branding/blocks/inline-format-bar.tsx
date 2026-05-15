'use client'

import { useEffect, useRef, useState } from 'react'
import { Bold, Italic, Underline, List, ListOrdered } from 'lucide-react'

interface BarState {
  visible: boolean
  top: number
  left: number
  allowLists: boolean
  active: { bold: boolean; italic: boolean; underline: boolean; ul: boolean; ol: boolean }
}

const HIDDEN: BarState = {
  visible: false,
  top: 0,
  left: 0,
  allowLists: false,
  active: { bold: false, italic: false, underline: false, ul: false, ol: false },
}

export function InlineFormatBar() {
  const [state, setState] = useState<BarState>(HIDDEN)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const update = () => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setState(HIDDEN)
        return
      }
      const range = sel.getRangeAt(0)
      const anchor = range.startContainer
      const el =
        anchor.nodeType === Node.ELEMENT_NODE
          ? (anchor as HTMLElement)
          : anchor.parentElement
      const surface = el?.closest('[data-inline-text="true"]') as HTMLElement | null
      if (!surface) {
        setState(HIDDEN)
        return
      }
      const rect = range.getBoundingClientRect()
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        setState(HIDDEN)
        return
      }
      const allowLists = surface.getAttribute('aria-multiline') === 'true'
      setState({
        visible: true,
        top: rect.top + window.scrollY - 44,
        left: rect.left + window.scrollX + rect.width / 2,
        allowLists,
        active: {
          bold: queryCmd('bold'),
          italic: queryCmd('italic'),
          underline: queryCmd('underline'),
          ul: queryCmd('insertUnorderedList'),
          ol: queryCmd('insertOrderedList'),
        },
      })
    }
    document.addEventListener('selectionchange', update)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      document.removeEventListener('selectionchange', update)
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [])

  const apply = (cmd: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    document.execCommand(cmd, false)
    // Re-emit selectionchange so we refresh active states
    setState((s) => ({
      ...s,
      active: {
        bold: queryCmd('bold'),
        italic: queryCmd('italic'),
        underline: queryCmd('underline'),
        ul: queryCmd('insertUnorderedList'),
        ol: queryCmd('insertOrderedList'),
      },
    }))
  }

  if (!state.visible) return null

  return (
    <div
      ref={barRef}
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'absolute',
        top: state.top,
        left: state.left,
        transform: 'translateX(-50%)',
        zIndex: 100,
      }}
      className="bg-white border border-gray-200 rounded-lg shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18),0_2px_6px_-2px_rgba(15,23,42,0.06)] flex items-center gap-0.5 p-1"
    >
      <FormatButton active={state.active.bold} onClick={apply('bold')} label="Bold (⌘B)">
        <Bold size={13} strokeWidth={2.25} />
      </FormatButton>
      <FormatButton active={state.active.italic} onClick={apply('italic')} label="Italic (⌘I)">
        <Italic size={13} strokeWidth={2.25} />
      </FormatButton>
      <FormatButton active={state.active.underline} onClick={apply('underline')} label="Underline (⌘U)">
        <Underline size={13} strokeWidth={2.25} />
      </FormatButton>
      {state.allowLists && (
        <>
          <Divider />
          <FormatButton active={state.active.ul} onClick={apply('insertUnorderedList')} label="Bullet list">
            <List size={13} strokeWidth={2.25} />
          </FormatButton>
          <FormatButton active={state.active.ol} onClick={apply('insertOrderedList')} label="Numbered list">
            <ListOrdered size={13} strokeWidth={2.25} />
          </FormatButton>
        </>
      )}
    </div>
  )
}

function FormatButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: (e: React.MouseEvent) => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-xs cursor-pointer transition ${
        active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="w-px h-4 bg-gray-200 mx-0.5" />
}

function queryCmd(cmd: string): boolean {
  try {
    return document.queryCommandState(cmd)
  } catch {
    return false
  }
}
