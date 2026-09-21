'use client'

/**
 * The button bar's action control: a `Select` choosing what the button
 * does (Link / Accept / Decline / Jump to section), plus the one extra
 * field each choice needs - a URL `Input` for Link, a section `Select`
 * for Jump - shown inline next to it. Split out of `node-bar-button.tsx`
 * to keep that file within its line budget.
 *
 * @module features/proposals/editor/bars/node-bar-button-action
 */
import { Select, type SelectOption } from '@/components/editor'
import { Input } from '@/components/ui/input'

import type { ButtonAction } from '../../model/doc'

import type { NodeBarSection } from './node-bar-shared'

type ActionKind = ButtonAction['kind']

const ACTION_OPTIONS: SelectOption<ActionKind>[] = [
  { value: 'link', label: 'Link' },
  { value: 'accept', label: 'Accept' },
  { value: 'decline', label: 'Decline' },
  { value: 'jump', label: 'Jump to section' },
]

/** Builds the default action for a freshly-chosen `kind`, keeping the previous link href (or jump target) when it already carried one. */
function actionFor(kind: ActionKind, previous: ButtonAction, sections: readonly NodeBarSection[]): ButtonAction {
  if (kind === 'link') return { kind: 'link', href: previous.kind === 'link' ? previous.href : 'https://' }
  if (kind === 'jump') return { kind: 'jump', sectionId: previous.kind === 'jump' ? previous.sectionId : (sections[0]?.id ?? '') }
  return { kind }
}

/** Props for {@link NodeBarButtonAction}. */
export interface NodeBarButtonActionProps {
  action: ButtonAction
  /** Sections offered by the Jump target's `Select`. */
  sections: readonly NodeBarSection[]
  onChange: (action: ButtonAction) => void
}

/** The action `Select`, plus Link's URL input or Jump's section select. */
export function NodeBarButtonAction({ action, sections, onChange }: NodeBarButtonActionProps) {
  return (
    <>
      <div className="w-[132px] shrink-0">
        <Select<ActionKind>
          size="xs"
          value={action.kind}
          options={ACTION_OPTIONS}
          onChange={(kind) => onChange(actionFor(kind, action, sections))}
        />
      </div>
      {action.kind === 'link' ? (
        <Input
          aria-label="Link URL"
          value={action.href}
          placeholder="https://…"
          className="w-40 shrink-0"
          onChange={(e) => onChange({ kind: 'link', href: e.target.value })}
        />
      ) : null}
      {action.kind === 'jump' ? (
        <div className="w-36 shrink-0">
          <Select<string>
            size="xs"
            value={action.sectionId}
            options={sections.map((s) => ({ value: s.id, label: s.name ?? s.kind }))}
            onChange={(sectionId) => onChange({ kind: 'jump', sectionId })}
            placeholder="Section…"
          />
        </div>
      ) : null}
    </>
  )
}
