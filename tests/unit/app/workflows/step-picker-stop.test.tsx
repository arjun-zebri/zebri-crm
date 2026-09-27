/**
 * The picker no longer offers the Stop step (Phase 6 fix wave).
 *
 * The engine has no handler for Stop: a workflow that reached one errored
 * at that step, while the picker promised "End the run here". The ruling
 * was to give it a handler or take it out; it is taken out, of the picker
 * and of the copilot's vocabulary. A Stop step already saved on a
 * template still shows on the canvas and is still named by the Turn on
 * pre-flight as a step that cannot run yet.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/app/(dashboard)/workflows/actions', () => ({ upsertTemplateStepRow: vi.fn() }))
vi.mock('@/app/(dashboard)/workflows/[id]/command-palette', () => ({
  CommandPalette: ({ items }: { items: { id: string; label: string }[] }) => (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{item.label}</li>
      ))}
    </ul>
  ),
}))

import { ActionPicker } from '@/app/(dashboard)/workflows/[id]/step-picker'
import { buildCopilotSystemPrompt } from '@/lib/workflows/ai-copilot/system-prompt'
import { validateStepConfig as validateModelStepConfig } from '@/lib/workflows/ai-copilot/tool-schemas'

describe('the Stop step', () => {
  it('is not offered in the step picker, while Wait and Branch are', () => {
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
    expect(screen.getByText('Wait')).toBeInTheDocument()
    expect(screen.getByText('Branch')).toBeInTheDocument()
    expect(screen.queryByText('Stop')).not.toBeInTheDocument()
  })

  it('is not taught to the copilot, and the copilot cannot add one', () => {
    const prompt = buildCopilotSystemPrompt()
    expect(prompt).not.toMatch(/^- stop:/m)
    expect(validateModelStepConfig('stop', {}).ok).toBe(false)
  })
})
