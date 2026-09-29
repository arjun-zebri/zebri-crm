/**
 * Adding a Start workflow step from the picker.
 *
 * An add skips the save-time config check only when the config is empty
 * (`isPlaceholderConfig` in the workflows actions). The step's first
 * default carried `endCurrent: true`, so the server ran the check, found
 * no workflow chosen, refused the add, and the step vanished from the
 * canvas the moment it was picked. The add must go out empty.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const upsertTemplateStepRow = vi.fn(async () => ({ ok: true as const, data: { id: 's1' } }))
vi.mock('@/app/(dashboard)/workflows/actions', () => ({
  upsertTemplateStepRow: (...a: unknown[]) => upsertTemplateStepRow(...(a as [])),
}))
vi.mock('@/app/(dashboard)/workflows/[id]/command-palette', () => ({
  CommandPalette: ({
    items,
    onPick,
  }: {
    items: { id: string; label: string }[]
    onPick: (id: string) => void
  }) => (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <button onClick={() => onPick(item.id)}>{item.label}</button>
        </li>
      ))}
    </ul>
  ),
}))

import { ActionPicker } from '@/app/(dashboard)/workflows/[id]/step-picker'

describe('picking Start workflow', () => {
  it('adds the step with an empty config, so the add is not refused', () => {
    render(
      <ActionPicker
        templateId="t1"
        parentStepId={null}
        branchPath={null}
        afterPosition={100}
        anchor={{ x: 0, y: 0 } as never}
        onClose={() => {}}
        onCreated={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start workflow' }))
    expect(upsertTemplateStepRow).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'start_workflow', config: {}, isNew: true }),
    )
  })
})
