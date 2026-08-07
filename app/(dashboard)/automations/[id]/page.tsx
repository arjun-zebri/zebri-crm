/**
 * Automation canvas builder.
 *
 * Minimal layout: just the canvas + a contextual right inspector
 * when a node is selected. No persistent library sidebar - every
 * "add" action is a click-target placeholder on the canvas itself,
 * which opens a Notion-style command palette to pick from.
 *
 *   ┌─ Header (back · name · saved · Test · Activate) ──┐
 *   │                                                   │
 *   │      [ Trigger card / Add trigger placeholder ]   │
 *   │                  │                                │
 *   │      [ Action ]                                   │
 *   │                  │                                │
 *   │      [ + Add action ]                             │
 *   │                                                   │
 *   └───────────────────────────────────────────────────┘
 *
 * Click the trigger card → trigger picker.
 * Click the "+ Add action" placeholder → action picker (flow + actions).
 * Click any existing node → right inspector opens with its config.
 *
 * Engine semantics are unchanged.
 *
 * @module app/(dashboard)/automations/[id]/page
 */
'use client'

import '@xyflow/react/dist/style.css'

import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import type {
  AutomationRow,
  AutomationStatus,
  AutomationActionRow,
  BranchPath,
  TriggerType,
} from '@/types/automations'

import {
  deleteAutomationActionRow,
  renameAutomationAction,
  setAutomationStatusAction,
  updateAutomationActionEdges,
  updateAutomationActionPosition,
} from '../actions'

import { ActionPicker } from './action-picker'
import { AiCopilotPanel } from './ai-copilot-panel'
import { autoLayout } from './auto-layout'
import { CanvasHeader } from './canvas-header'
import { CanvasNode, type CanvasNodeData } from './canvas-node'
import { CanvasSkeleton } from './canvas-skeleton'
import { InspectorPanel } from './inspector-panel'
import { RunHistoryPanel } from './runs-panel'
import { TriggerPicker } from './trigger-picker'

const TRIGGER_NODE_ID = '__trigger__'
const ADD_ACTION_NODE_ID = '__add_action__'

/**
 * Feature flag for the Zebri AI copilot on the automation canvas. Hidden for
 * now; set to `true` to bring the panel and its open button back.
 */
const SHOW_ZEBRI_AI = false

const nodeTypes = { canvasNode: CanvasNode }

export default function AutomationCanvasPage() {
  return (
    <ReactFlowProvider>
      <AutomationCanvas />
    </ReactFlowProvider>
  )
}

function AutomationCanvas() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const automationId = params.id

  const [automation, setAutomation] = useState<AutomationRow | null>(null)
  const [actions, setActions] = useState<AutomationActionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savedAt, setSavedAt] = useState<Date>(new Date())
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [triggerPickerAnchor, setTriggerPickerAnchor] = useState<{ x: number; y: number } | null>(null)
  const [copilotOpen, setCopilotOpen] = useState(true)
  const [runsOpen, setRunsOpen] = useState(false)
  const [actionPickerCtx, setActionPickerCtx] = useState<
    | null
    | {
        parentActionId: string | null
        branchPath: BranchPath | null
        afterPosition: number
        positionX: number
        positionY: number
        anchor: { x: number; y: number }
      }
  >(null)

  const reloadActions = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('automation_actions' as never)
      .select('*')
      .eq('automation_id', automationId)
      .order('position', { ascending: true })
    setActions(((data as AutomationActionRow[] | null) ?? []))
    setSavedAt(new Date())
  }, [automationId])


  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    setLoading(true)
    Promise.all([
      supabase.from('automations' as never).select('*').eq('id', automationId).single(),
      supabase
        .from('automation_actions' as never)
        .select('*')
        .eq('automation_id', automationId)
        .order('position', { ascending: true }),
    ]).then(([a, s]) => {
      if (cancelled) return
      setAutomation((a.data as AutomationRow | null) ?? null)
      setActions(((s.data as AutomationActionRow[] | null) ?? []))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [automationId])

  /* ── React Flow nodes/edges derived from actions + auto-layout ──── */

  const layout = useMemo(() => autoLayout(actions), [actions])

  const triggerIsSet =
    !!automation?.trigger_type && (automation.trigger_type as string) !== 'unset'

  const tailContext = useMemo(() => {
    // Compute where to anchor the "+ Add action" placeholder.
    // Sits below the deepest top-level action, or directly under the
    // trigger if there are no actions yet.
    const topLevel = actions.filter((a) => !a.parent_action_id).sort((a, b) => a.position - b.position)
    if (topLevel.length === 0) {
      return {
        parentActionId: null,
        branchPath: null as BranchPath | null,
        afterPosition: 100,
        x: layout.trigger.x,
        y: layout.trigger.y + 160,
      }
    }
    const last = topLevel[topLevel.length - 1]!
    const lastPlaced = layout.actions[last.id] ?? { x: layout.trigger.x, y: 0 }
    return {
      parentActionId: null,
      branchPath: null as BranchPath | null,
      afterPosition: last.position + 100,
      x: lastPlaced.x,
      y: lastPlaced.y + 160,
    }
  }, [actions, layout])

  const initialNodes = useMemo<Node<CanvasNodeData>[]>(() => {
    if (!automation) return []
    const triggerNode: Node<CanvasNodeData> = {
      id: TRIGGER_NODE_ID,
      type: 'canvasNode',
      position: layout.trigger,
      deletable: false,
      data: {
        kind: 'trigger',
        action: null,
        triggerType: (automation.trigger_type as TriggerType | 'unset'),
        triggerConfig: (automation.trigger_config as Record<string, unknown>) ?? {},
      },
    }
    const actionNodes: Node<CanvasNodeData>[] = actions.map((action) => ({
      id: action.id,
      type: 'canvasNode',
      position: layout.actions[action.id] ?? { x: 0, y: 0 },
      data: { kind: nodeKindFor(action.type), action } as CanvasNodeData,
    }))
    // Only show the "Add action" placeholder once the trigger is set.
    const addActionNode: Node<CanvasNodeData> | null = triggerIsSet
      ? {
          id: ADD_ACTION_NODE_ID,
          type: 'canvasNode',
          position: { x: tailContext.x, y: tailContext.y },
          deletable: false,
          selectable: false,
          data: { kind: 'add_action', action: null } as CanvasNodeData,
        }
      : null
    return [triggerNode, ...actionNodes, ...(addActionNode ? [addActionNode] : [])]
  }, [automation, actions, layout, triggerIsSet, tailContext])

  const initialEdges = useMemo<Edge[]>(() => {
    const topLevel = actions.filter((a) => !a.parent_action_id).sort((a, b) => a.position - b.position)
    const edges: Edge[] = []
    // Trigger → first top-level action, or trigger → add-action ghost.
    if (triggerIsSet) {
      if (topLevel[0]) {
        edges.push({
          id: `${TRIGGER_NODE_ID}->${topLevel[0].id}`,
          source: TRIGGER_NODE_ID,
          target: topLevel[0].id,
        })
      } else {
        edges.push({
          id: `${TRIGGER_NODE_ID}->add`,
          source: TRIGGER_NODE_ID,
          target: ADD_ACTION_NODE_ID,
          style: { strokeDasharray: '4 4', stroke: 'var(--color-border)' },
        })
      }
    }
    for (let i = 0; i < topLevel.length - 1; i++) {
      edges.push({
        id: `${topLevel[i]!.id}->${topLevel[i + 1]!.id}`,
        source: topLevel[i]!.id,
        target: topLevel[i + 1]!.id,
      })
    }
    // Tail edge: last top-level action → add-action ghost (dashed).
    if (triggerIsSet && topLevel.length > 0) {
      edges.push({
        id: `${topLevel[topLevel.length - 1]!.id}->add`,
        source: topLevel[topLevel.length - 1]!.id,
        target: ADD_ACTION_NODE_ID,
        style: { strokeDasharray: '4 4', stroke: 'var(--color-border)' },
      })
    }
    // Branch wiring identical to before.
    for (const action of actions.filter((a) => a.type === 'branch')) {
      for (const branchPath of ['yes', 'no'] as BranchPath[]) {
        const children = actions
          .filter((a) => a.parent_action_id === action.id && a.branch_path === branchPath)
          .sort((a, b) => a.position - b.position)
        if (children[0]) {
          edges.push({
            id: `${action.id}-${branchPath}->${children[0].id}`,
            source: action.id,
            sourceHandle: branchPath,
            target: children[0].id,
          })
        }
        for (let i = 0; i < children.length - 1; i++) {
          edges.push({
            id: `${children[i]!.id}->${children[i + 1]!.id}`,
            source: children[i]!.id,
            target: children[i + 1]!.id,
          })
        }
      }
    }
    return edges
  }, [actions, triggerIsSet])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    setNodes(initialNodes)
  }, [initialNodes, setNodes])
  useEffect(() => {
    setEdges(initialEdges)
  }, [initialEdges, setEdges])

  /* ── Drag → persist position ──────────────────────────────── */

  const dragPersistTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes)
      for (const c of changes) {
        if (
          c.type === 'position' &&
          c.position &&
          c.id !== TRIGGER_NODE_ID &&
          c.id !== ADD_ACTION_NODE_ID &&
          !c.dragging
        ) {
          const id = c.id
          const pos = c.position
          const existing = dragPersistTimeouts.current.get(id)
          if (existing) clearTimeout(existing)
          dragPersistTimeouts.current.set(
            id,
            setTimeout(() => {
              void updateAutomationActionPosition({ actionId: id, positionX: pos.x, positionY: pos.y }).then(() => {
                setSavedAt(new Date())
              })
            }, 250),
          )
        }
      }
    },
    [onNodesChange],
  )

  /* ── Click handling ──────────────────────────────────────── */

  const onNodeClick = useCallback(
    (e: React.MouseEvent, node: Node) => {
      if (node.id === TRIGGER_NODE_ID) {
        // Trigger already chosen → open the inspector drawer to
        // configure params. Unset → open the picker palette so the
        // user can choose what fires this automation.
        if (triggerIsSet) {
          setSelectedNodeId(TRIGGER_NODE_ID)
        } else {
          setTriggerPickerAnchor({ x: e.clientX, y: e.clientY })
          setSelectedNodeId(null)
        }
        return
      }
      if (node.id === ADD_ACTION_NODE_ID) {
        setActionPickerCtx({
          parentActionId: tailContext.parentActionId,
          branchPath: tailContext.branchPath,
          afterPosition: tailContext.afterPosition,
          positionX: tailContext.x,
          positionY: tailContext.y,
          anchor: { x: e.clientX, y: e.clientY },
        })
        setSelectedNodeId(null)
        return
      }
      setSelectedNodeId(node.id)
    },
    [tailContext, triggerIsSet],
  )

  /* ── Connect handles → persist parent_action_id ─────────────── */

  const onConnect = useCallback(
    async (conn: Connection) => {
      if (!conn.source || !conn.target) return
      if (conn.target === ADD_ACTION_NODE_ID) return
      setEdges((eds) => addEdge(conn, eds))
      if (conn.source === TRIGGER_NODE_ID) {
        await updateAutomationActionEdges({ actionId: conn.target, parentActionId: null, branchPath: null })
      } else {
        const branchPath = (conn.sourceHandle as BranchPath | undefined) ?? null
        await updateAutomationActionEdges({
          actionId: conn.target,
          parentActionId: branchPath ? conn.source : null,
          branchPath,
        })
      }
      void reloadActions()
    },
    [setEdges, reloadActions],
  )

  const inspectorSelection = useMemo<
    | { kind: 'trigger'; triggerType: TriggerType; triggerConfig: Record<string, unknown> }
    | { kind: 'action'; action: AutomationActionRow }
    | null
  >(() => {
    if (!selectedNodeId || !automation) return null
    if (selectedNodeId === ADD_ACTION_NODE_ID) return null
    if (selectedNodeId === TRIGGER_NODE_ID) {
      const triggerType = automation.trigger_type as TriggerType | 'unset'
      if (triggerType === 'unset') return null
      return {
        kind: 'trigger',
        triggerType,
        triggerConfig: (automation.trigger_config as Record<string, unknown>) ?? {},
      }
    }
    const action = actions.find((a) => a.id === selectedNodeId)
    if (!action) return null
    return { kind: 'action', action }
  }, [selectedNodeId, automation, actions])

  async function handleRename(name: string) {
    if (!automation || name === automation.name) return
    await renameAutomationAction({ automationId, name })
    setAutomation((prev) => (prev ? { ...prev, name } : prev))
    setSavedAt(new Date())
  }

  async function handleToggleActive() {
    if (!automation) return
    const next: AutomationStatus = automation.status === 'active' ? 'paused' : 'active'
    await setAutomationStatusAction({ automationId, status: next })
    setAutomation((prev) => (prev ? { ...prev, status: next } : prev))
    setSavedAt(new Date())
  }

  if (loading) return <CanvasSkeleton />
  if (!automation) return <div className="p-8 text-text-muted">Automation not found</div>

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CanvasHeader
        name={automation.name}
        status={automation.status}
        savedAt={savedAt}
        onBack={() => router.push('/automations')}
        onRename={handleRename}
        onToggleActive={handleToggleActive}
        onShowRuns={() => setRunsOpen(true)}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Zebri AI copilot temporarily hidden. Flip SHOW_ZEBRI_AI to re-enable. */}
        {SHOW_ZEBRI_AI && (
          <AiCopilotPanel open={copilotOpen} onClose={() => setCopilotOpen(false)} />
        )}
        <div className="flex-1 relative">
          {SHOW_ZEBRI_AI && !copilotOpen && (
            <button
              type="button"
              onClick={() => setCopilotOpen(true)}
              className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-body bg-surface border border-border rounded-control hover:bg-surface-muted cursor-pointer transition shadow-sm"
              title="Open Zebri AI"
            >
              <CopilotIcon />
              Zebri AI
            </button>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelectedNodeId(null)}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3, maxZoom: 1, minZoom: 0.5 }}
            minZoom={0.4}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
            onNodesDelete={async (deletedNodes) => {
              for (const n of deletedNodes) {
                if (n.id === TRIGGER_NODE_ID || n.id === ADD_ACTION_NODE_ID) continue
                await deleteAutomationActionRow({ actionId: n.id, automationId })
              }
              await reloadActions()
            }}
          >
            <Background gap={20} size={1} color="var(--color-border)" />
          </ReactFlow>
        </div>
        {inspectorSelection && (
          <InspectorPanel
            selection={inspectorSelection}
            automationId={automationId}
            onClose={() => setSelectedNodeId(null)}
            onSaved={(payload) => {
              // Optimistic patch - no network reload. The drawer's
              // local form state already reflects the new config;
              // we just have to mirror it into the page so the
              // canvas / next-open shows it too.
              if (payload.kind === 'trigger') {
                setAutomation((prev) =>
                  prev ? { ...prev, trigger_config: payload.triggerConfig as never } : prev,
                )
              } else {
                setActions((prev) =>
                  prev.map((a) =>
                    a.id === payload.actionId ? { ...a, config: payload.config as never } : a,
                  ),
                )
              }
              setSavedAt(new Date())
            }}
            onChangeTrigger={(e) => {
              setSelectedNodeId(null)
              setTriggerPickerAnchor({ x: e.clientX, y: e.clientY })
            }}
            onDeleteAction={async (actionId) => {
              // Delete is destructive - optimistically remove the
              // action then fire the server action.
              setActions((prev) => prev.filter((a) => a.id !== actionId))
              setSelectedNodeId(null)
              setSavedAt(new Date())
              void deleteAutomationActionRow({ actionId, automationId })
            }}
          />
        )}
        <RunHistoryPanel
          automationId={automationId}
          actions={actions}
          open={runsOpen}
          onClose={() => setRunsOpen(false)}
        />
      </div>

      {triggerPickerAnchor && (
        <TriggerPicker
          automationId={automationId}
          currentTrigger={(automation.trigger_type as TriggerType | 'unset')}
          anchor={triggerPickerAnchor}
          onClose={() => setTriggerPickerAnchor(null)}
          onPicked={(next) => {
            setAutomation((prev) =>
              prev
                ? { ...prev, trigger_type: next as TriggerType, trigger_config: {} as never }
                : prev,
            )
            setTriggerPickerAnchor(null)
            setSavedAt(new Date())
            // Auto-open the inspector drawer for the new trigger so
            // the user lands directly on the parameter form.
            if (next !== 'unset') setSelectedNodeId(TRIGGER_NODE_ID)
            else setSelectedNodeId(null)
          }}
        />
      )}

      {actionPickerCtx && (
        <ActionPicker
          automationId={automationId}
          parentActionId={actionPickerCtx.parentActionId}
          branchPath={actionPickerCtx.branchPath}
          afterPosition={actionPickerCtx.afterPosition}
          positionX={actionPickerCtx.positionX}
          positionY={actionPickerCtx.positionY}
          anchor={actionPickerCtx.anchor}
          onClose={() => setActionPickerCtx(null)}
          onCreated={(optimistic, serverResult) => {
            // The action's id is generated client-side and the server
            // upserts under that id, so the optimistic row IS the
            // real row - no swap needed. We only watch the server
            // promise so we can roll back if the insert fails.
            setActions((prev) => [...prev, optimistic])
            setActionPickerCtx(null)
            setSavedAt(new Date())
            void serverResult.then((res) => {
              if (!res.ok) {
                setActions((prev) => prev.filter((a) => a.id !== optimistic.id))
              }
            })
          }}
        />
      )}
    </div>
  )
}

function CopilotIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-brand"
      aria-hidden
    >
      <path d="M9.94 14.062 12 13l-2.06-1.062L8.875 9.875 7.812 11.94 5.75 13l2.062 1.062L8.875 16.125l1.063-2.063Z" />
      <path d="M18 5v4" />
      <path d="M16 7h4" />
      <path d="M15 14v2" />
      <path d="M14 15h2" />
    </svg>
  )
}

function nodeKindFor(type: AutomationActionRow['type']): CanvasNodeData['kind'] {
  switch (type) {
    case 'wait':
      return 'wait'
    case 'branch':
      return 'branch'
    case 'stop':
      return 'stop'
    case 'approval':
      return 'approval'
    case 'sub_flow':
      return 'action'
    default:
      return 'action'
  }
}
