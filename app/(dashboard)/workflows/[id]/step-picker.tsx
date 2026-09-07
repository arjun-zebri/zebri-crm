/**
 * Action picker popover.
 *
 * Opens when the user clicks an "Add action" placeholder node on
 * the canvas. Lists flow controls + every action via the shared
 * command palette. Picking one optimistically inserts the action
 * locally (with a temp UUID), closes the palette, and fires the
 * server-side insert in the background. The page reconciles the
 * temp id with the real id once the server returns.
 *
 * @module app/(dashboard)/workflows/[id]/step-picker
 */
'use client'

import { CalendarClock, CheckSquare, Clock, GitBranch, type LucideIcon, Square } from 'lucide-react'

import { actionUi } from '@/lib/automations/actions/ui'
import { isActionLaunchVisible } from '@/lib/automations/launch-catalogue'
import type { ActionType, AutomationActionRow } from '@/types/automations'

import { updateTemplateStepPosition, upsertTemplateStepRow } from '../actions'

import { CommandPalette, type PaletteAnchor, type PaletteItem } from './command-palette'
import { getLucideIcon } from './lucide-lookup'

interface Props {
  templateId: string
  parentStepId: string | null
  branchPath: 'yes' | 'no' | null
  afterPosition: number
  positionX: number
  positionY: number
  anchor: PaletteAnchor
  onClose: () => void
  /** Fires synchronously with the optimistic row + a server promise.
   *  The action uses a client-generated UUID that the server preserves,
   *  so the optimistic id is already the real id - the promise just
   *  lets the caller roll back on failure. */
  onCreated: (
    optimistic: AutomationActionRow,
    serverResult: Promise<{ ok: true } | { ok: false; error: string }>,
  ) => void
}

/**
 * The manual step types.
 *
 * These are why the feature exists: a to-do sitting unticked is what
 * holds up every automated step anchored behind it. Without them in the
 * picker a template could only ever be automated end to end, and the
 * gating mechanism would be unreachable from the canvas.
 *
 * They are not actions, so they carry their own slug prefix and skip
 * `defaultActionConfigFor`.
 */
const MANUAL_ITEMS: {
  id: string
  stepType: 'todo' | 'appointment'
  label: string
  description: string
  icon: LucideIcon
}[] = [
  {
    id: 'manual:todo',
    stepType: 'todo',
    label: 'To-do',
    description: 'Something you tick off yourself',
    icon: CheckSquare,
  },
  {
    id: 'manual:appointment',
    stepType: 'appointment',
    label: 'Appointment',
    description: 'A dated meeting to hold in the diary',
    icon: CalendarClock,
  },
]

const FLOW_ITEMS: {
  id: string
  label: string
  description: string
  actionType: ActionType
  icon: LucideIcon
}[] = [
  { id: 'flow:wait', actionType: 'wait', label: 'Wait', description: 'Pause before the next action', icon: Clock },
  { id: 'flow:branch', actionType: 'branch', label: 'Branch', description: 'If / else split based on a condition', icon: GitBranch },
  { id: 'flow:stop', actionType: 'stop', label: 'Stop', description: 'End the run here', icon: Square },
  // `sub_flow` + `approval` are implemented by the runner but are NOT
  // in the review-file catalogue (automations-review.md → FLOW CONTROL
  // is wait/branch/stop only), so they're omitted from the picker.
  // Existing automations that use them still render and run.
]

// Flow control comes first (wait / branch / stop / approval / sub_flow
// are the high-frequency picks), then the action categories. We
// define the order explicitly here rather than reusing
// ACTION_CATEGORIES because that constant already includes a `flow`
// slug for the `pause_couple_automations` action - merging would
// duplicate the header.
const GROUP_ORDER: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: 'manual', label: 'Yours to do' },
  { slug: 'flow', label: 'Flow control' },
  { slug: 'general', label: 'General' },
  { slug: 'couple', label: 'Couple' },
  { slug: 'calendar', label: 'Calendar' },
  { slug: 'consultation', label: 'Consultations' },
  { slug: 'payments', label: 'Payments' },
  { slug: 'compliance', label: 'Compliance & paperwork (AU)' },
  { slug: 'segmentation', label: 'Tags & segmentation' },
  { slug: 'integration', label: 'Integrations (outbound)' },
  { slug: 'post_event', label: 'Post-event' },
]

export function ActionPicker({
  templateId,
  parentStepId,
  branchPath,
  afterPosition,
  positionX,
  positionY,
  anchor,
  onClose,
  onCreated,
}: Props) {
  const items: PaletteItem[] = [
    ...MANUAL_ITEMS.map((m) => ({
      id: m.id,
      group: 'manual',
      label: m.label,
      description: m.description,
      icon: m.icon,
    })),
    ...FLOW_ITEMS.map((f) => ({
      id: f.id,
      group: 'flow',
      label: f.label,
      description: f.description,
      icon: f.icon,
    })),
    // Only surface actions whose handler does something today. The
    // registry carries the full catalogue (un-reviewed extras +
    // to-wire stubs); the launch allowlist hides dead tiles. The one
    // exception is `send_sms`, which stays listed but greyed via its
    // `comingSoon` flag (kept per the catalogue review).
    ...Object.entries(actionUi)
      .filter(([type]) => isActionLaunchVisible(type as ActionType))
      .map(([type, ui]) => ({
        id: `action:${type}`,
        group: ui.category,
        label: ui.comingSoon ? `${ui.label} (coming soon)` : ui.label,
        description: ui.description,
        icon: getLucideIcon(ui.icon),
        // Listed so the MC knows it is coming, but not selectable:
        // adding a step that cannot send is adding a step that fails.
        disabled: ui.comingSoon === true,
      })),
  ]

  function pick(id: string) {
    // Generate the UUID client-side and reuse it for both the
    // optimistic row and the server insert. With UPSERT semantics
    // server-side, the id is stable across the optimistic insert
    // and the persisted row - no reconciliation needed.
    const stepId = crypto.randomUUID()
    let optimistic: AutomationActionRow | null = null
    let serverPromise: Promise<{ ok: true } | { ok: false; error: string }> | null = null

    if (id.startsWith('manual:')) {
      const manual = MANUAL_ITEMS.find((m) => m.id === id)
      if (!manual) return
      // The builder's optimistic row speaks action slugs; `todo` and
      // `appointment` are stored types in their own right, so the slug
      // and the stored type are the same string and `splitStepType`
      // passes them straight through.
      optimistic = buildOptimisticAction({
        id: stepId, templateId, position: afterPosition,
        type: manual.stepType as unknown as ActionType,
        config: {}, parentStepId, branchPath, positionX, positionY,
      })
      serverPromise = persistAction({
        stepId, templateId, position: afterPosition,
        type: manual.stepType as unknown as ActionType,
        config: {}, parentStepId, branchPath, positionX, positionY,
      })
    } else if (id.startsWith('flow:')) {
      const flow = FLOW_ITEMS.find((f) => f.id === id)
      if (!flow) return
      const config = defaultActionConfigFor(flow.actionType)
      optimistic = buildOptimisticAction({
        id: stepId, templateId, position: afterPosition, type: flow.actionType,
        config, parentStepId, branchPath, positionX, positionY,
      })
      serverPromise = persistAction({
        stepId, templateId, position: afterPosition, type: flow.actionType,
        config, parentStepId, branchPath, positionX, positionY,
      })
    } else if (id.startsWith('action:')) {
      const actionType = id.slice('action:'.length)
      const config = defaultActionConfigFor(actionType as ActionType)
      optimistic = buildOptimisticAction({
        id: stepId, templateId, position: afterPosition, type: actionType as ActionType,
        config, parentStepId, branchPath, positionX, positionY,
      })
      serverPromise = persistAction({
        stepId, templateId, position: afterPosition, type: actionType as ActionType,
        config, parentStepId, branchPath, positionX, positionY,
      })
    }
    if (optimistic && serverPromise) onCreated(optimistic, serverPromise)
  }

  return (
    <CommandPalette
      title="Add step"
      placeholder="Find a step…"
      items={items}
      groupOrder={GROUP_ORDER}
      anchor={anchor}
      onClose={onClose}
      onPick={pick}
    />
  )
}

async function persistAction(args: {
  stepId: string
  templateId: string
  position: number
  type: ActionType
  config: Record<string, unknown>
  parentStepId: string | null
  branchPath: 'yes' | 'no' | null
  positionX: number
  positionY: number
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await upsertTemplateStepRow({
    stepId: args.stepId,
    templateId: args.templateId,
    position: args.position,
    type: args.type,
    config: args.config as never,
    parentStepId: args.parentStepId,
    branchPath: args.branchPath,
  })
  if (!result.ok) return { ok: false, error: result.error }
  await updateTemplateStepPosition({
    stepId: args.stepId,
    positionX: args.positionX,
    positionY: args.positionY,
  })
  return { ok: true }
}

function buildOptimisticAction(args: {
  id: string
  templateId: string
  position: number
  type: ActionType
  config: Record<string, unknown>
  parentStepId: string | null
  branchPath: 'yes' | 'no' | null
  positionX: number
  positionY: number
}): AutomationActionRow {
  const now = new Date().toISOString()
  return {
    id: args.id,
    automation_id: args.templateId,
    position: args.position,
    type: args.type,
    config: args.config as never,
    parent_action_id: args.parentStepId,
    branch_path: args.branchPath,
    label: null,
    disabled: false,
    position_x: args.positionX,
    position_y: args.positionY,
    created_at: now,
    updated_at: now,
  }
}

function defaultActionConfigFor(type: ActionType): Record<string, unknown> {
  switch (type) {
    // Registered actions
    case 'send_email':
      return { recipients: { roles: ['primary'], fallback: 'primary_only' }, subject: 'Subject line', body: 'Hi {{couple.primary_name}},\n\nYour message here.\n\n- {{mc.contact_name}}', wrap: true }
    case 'create_task':
      // Same: the modal's placeholder does this job.
      return {}
    case 'update_couple_stage':
      return { toStatus: 'contacted' }
    case 'add_note':
      // Empty: the composer's placeholder says what goes here, and a
      // default nobody typed reads as a note they wrote.
      return {}
    // Flow-control actions
    case 'wait':
      return { mode: 'duration', durationMinutes: 24 * 60, respectQuietHours: true }
    case 'branch':
      // No predicate: the card opens on "Add condition" rather than a
      // guess about which condition was meant.
      return {}
    case 'stop':
      return {}
    case 'approval':
      return { prompt: 'Approve this action?', expiresInDays: 3, approverEmail: '' }
    case 'sub_flow':
      return { templateId: '' }
    default:
      return {}
  }
}
