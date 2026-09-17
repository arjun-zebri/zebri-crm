'use client'

/**
 * The section bar's name field: a ghost `Button` that turns into an
 * `Input` on click, mirroring `app/(dashboard)/proposals/templates/template-row.tsx`'s
 * rename pattern. Split out of `section-bar.tsx` to keep that file within
 * its line budget.
 *
 * @module features/proposals/editor/bars/section-name-field
 */
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'

import type { Section, SectionKind } from '../../model/layout'
import type { SectionCanvasProps } from '../section-canvas'

/** Fallback label for a section with no name of its own, by kind. */
const KIND_LABELS: Record<SectionKind, string> = {
  content: 'Text', packages: 'Packages', gallery: 'Gallery', video: 'Video',
  testimonials: 'Testimonials', faq: 'FAQ', accept: 'Accept',
}

/** Props for {@link SectionNameField}. */
export interface SectionNameFieldProps {
  section: Section
  dispatch: SectionCanvasProps['dispatch']
}

/** The section name field. See the module doc for the rename pattern it mirrors. */
export function SectionNameField({ section, dispatch }: SectionNameFieldProps) {
  const fallback = KIND_LABELS[section.kind]
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(section.name ?? fallback)
  // Adopts an externally-driven rename (e.g. undo) once it lands; mirrors
  // `template-row.tsx`'s own render-phase sync for the same reason.
  const [synced, setSynced] = useState(section.name)
  if (section.name !== synced) {
    setSynced(section.name)
    setValue(section.name ?? fallback)
  }
  const cancelledRef = useRef(false)

  const commit = () => {
    if (cancelledRef.current) {
      cancelledRef.current = false
      return
    }
    setEditing(false)
    const name = value.trim()
    if (name && name !== (section.name ?? fallback)) {
      dispatch({ type: 'setName', id: section.id, name }, { commit: true })
    } else {
      setValue(section.name ?? fallback)
    }
  }

  if (editing) {
    return (
      <Input
        aria-label="Section name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            cancelledRef.current = true
            setValue(section.name ?? fallback)
            setEditing(false)
          }
        }}
        autoFocus
        className="w-32 shrink-0"
      />
    )
  }

  return (
    <Tooltip label="Click to rename" className="shrink-0">
      <Button
        variant="ghost"
        aria-label={`Rename ${value}`}
        onClick={() => {
          cancelledRef.current = false
          setEditing(true)
        }}
        className="w-32 shrink-0 justify-start"
      >
        <span className="truncate">{value}</span>
      </Button>
    </Tooltip>
  )
}
