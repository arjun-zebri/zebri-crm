/**
 * Automation builder canvas.
 *
 *   ┌─ Header (back · name · saved · Test · Activate) ──┐
 *   │  · · · · · · · · · · · · · · · · · · · · · · · ·  │
 *   │            TRIGGER                                │
 *   │        [ New enquiry · from Referral ]            │
 *   │                  │                                │
 *   │        [ Send welcome email ]                     │
 *   │                  ┊                                │
 *   │        [ + Add action ]                           │
 *   │                                                   │
 *   │      ( Ask Zebri to build a step …        ↑ )     │
 *   └───────────────────────────────────────────────────┘
 *
 * Nodes drag freely, the canvas zooms, and edges follow. Config lives
 * inside the node: clicking a card expands it in place to hold its
 * filter chips or action form, so there is no side rail. That is the
 * one change from the original canvas, and it exists because a fixed
 * 340px rail was both too empty for a two-filter trigger and too
 * narrow to write an email in.
 *
 * Engine semantics are unchanged: run order comes from `position` /
 * `parent_action_id` / `branch_path`. Node x/y is presentation only,
 * persisted per drag so a layout survives a reload.
 *
 * @module app/(dashboard)/automations/[id]/page
 */
'use client';

import '@xyflow/react/dist/style.css';

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
} from '@xyflow/react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { actionUi } from '@/lib/automations/actions/ui';
import { triggerRegistry } from '@/lib/automations/triggers';
import { createClient } from '@/lib/supabase/client';
import type {
  ActionType,
  AutomationRow,
  AutomationStatus,
  AutomationActionRow,
  BranchPath,
  TriggerType,
} from '@/types/automations';

import {
  deleteAutomationActionRow,
  renameAutomationAction,
  setAutomationStatusAction,
  setAutomationTriggerAction,
  updateAutomationActionEdges,
  updateAutomationActionPosition,
} from '../actions';

import { ActionPicker } from './action-picker';
import { AiCopilotBar } from './ai-copilot-bar';
import { ROW_GAP, autoLayout } from './auto-layout';
import { CanvasHeader } from './canvas-header';
import { CanvasSkeleton } from './canvas-skeleton';
import { useQuestionnaireTemplateOptions } from './filter-options';
import { FlowNode, FlowNodeContext, type FlowNodeApi, type FlowNodeData } from './flow-node';
import { MODAL_ACTIONS, StepConfigForm } from './inspector-panel';
import { RunHistoryPanel } from './runs-panel';
import { stepSummary, stepTitle, type StepSummaryLabels } from './step-summary';
import { TriggerCardBody, triggerSummaryLine, useTriggerFilters } from './trigger-card-body';
import { TriggerPicker } from './trigger-picker';

const TRIGGER_NODE_ID = '__trigger__';
const ADD_ACTION_NODE_ID = '__add_action__';

/** Feature flag for the Zebri AI bar. */
const SHOW_ZEBRI_AI = true;

const nodeTypes = { flowNode: FlowNode };

/** Node stacking: dashed placeholder < resting card < the opened card. */
const PLACEHOLDER_Z = 0;
const CARD_Z = 1;
const EXPANDED_Z = 20;

export default function AutomationCanvasPage() {
  return (
    <ReactFlowProvider>
      <AutomationCanvas />
    </ReactFlowProvider>
  );
}

function AutomationCanvas() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const automationId = params.id;

  const [automation, setAutomation] = useState<AutomationRow | null>(null);
  const [actions, setActions] = useState<AutomationActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState<Date>(new Date());
  // Opens collapsed: a canvas should show the shape of the flow first,
  // and an auto-expanded trigger overlaps whatever sits under it.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Nodes whose config form has been mounted. A card animates open by
  // growing a wrapper that is always in the DOM, but mounting every
  // node's form up front would build dozens of forms nobody opens, so
  // the body appears the first time a node is opened and stays after.
  const [openedIds, setOpenedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [runsOpen, setRunsOpen] = useState(false);
  const [triggerPickerAnchor, setTriggerPickerAnchor] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [actionPickerCtx, setActionPickerCtx] = useState<null | {
    parentActionId: string | null;
    branchPath: BranchPath | null;
    afterPosition: number;
    positionX: number;
    positionY: number;
    anchor: { x: number; y: number };
  }>(null);

  const reloadActions = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('automation_actions' as never)
      .select('*')
      .eq('automation_id', automationId)
      .order('position', { ascending: true });
    setActions((data as AutomationActionRow[] | null) ?? []);
    setSavedAt(new Date());
  }, [automationId]);

  // Copilot edits can touch the trigger (automation row) as well as
  // the steps, so its refresh callback reloads both.
  const reloadWorkflow = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('automations' as never)
      .select('*')
      .eq('id', automationId)
      .maybeSingle();
    if (data) setAutomation(data as AutomationRow);
    await reloadActions();
  }, [automationId, reloadActions]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    setLoading(true);
    Promise.all([
      supabase.from('automations' as never).select('*').eq('id', automationId).single(),
      supabase
        .from('automation_actions' as never)
        .select('*')
        .eq('automation_id', automationId)
        .order('position', { ascending: true }),
    ]).then(([a, s]) => {
      if (cancelled) return;
      setAutomation((a.data as AutomationRow | null) ?? null);
      setActions((s.data as AutomationActionRow[] | null) ?? []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [automationId]);

  const triggerType = (automation?.trigger_type ?? 'unset') as TriggerType | 'unset';
  const triggerIsSet = triggerType !== 'unset';
  const triggerConfig = useMemo(
    () => (automation?.trigger_config as Record<string, unknown>) ?? {},
    [automation],
  );
  const filters = useTriggerFilters(triggerType as TriggerType, triggerConfig);

  /* ── Config autosave ───────────────────────────────────────── */

  // The chip UI writes whole-config patches, so the trigger's save path
  // lives here: the card body stays stateless and the page remains the
  // single owner of the automation row.
  const handleTriggerConfigChange = useCallback(
    (next: Record<string, unknown>) => {
      setAutomation((prev) => (prev ? { ...prev, trigger_config: next as never } : prev));
      setSavedAt(new Date());
      if (!triggerIsSet) return;
      void setAutomationTriggerAction({
        automationId,
        triggerType: triggerType as string,
        triggerConfig: next,
      });
    },
    [automationId, triggerType, triggerIsSet],
  );

  /* ── Layout → nodes / edges ────────────────────────────────── */

  const layout = useMemo(() => autoLayout(actions), [actions]);

  const tailContext = useMemo(() => {
    const topLevel = actions
      .filter((a) => !a.parent_action_id)
      .sort((a, b) => a.position - b.position);
    if (topLevel.length === 0) {
      return {
        parentActionId: null,
        branchPath: null as BranchPath | null,
        afterPosition: 100,
        x: layout.trigger.x,
        // A whole row's worth of clearance rather than one gap: with
        // nothing built yet the trigger usually sits open, and the
        // placeholder tucked right under it read as part of the card.
        y: layout.trigger.y + ROW_GAP * 1.75,
      };
    }
    const last = topLevel[topLevel.length - 1]!;
    const lastPlaced = layout.actions[last.id] ?? { x: layout.trigger.x, y: 0 };
    return {
      parentActionId: null,
      branchPath: null as BranchPath | null,
      afterPosition: last.position + 100,
      x: lastPlaced.x,
      // Clears every placed node: branch children hang below the last
      // top-level action, so `lastPlaced.y + 160` overlapped them.
      y: layout.tailY,
    };
  }, [actions, layout]);

  // Names for the ids a step config stores but cannot read. The
  // picker already loads this list, so the card reuses it rather than
  // fetching again.
  const questionnaireOptions = useQuestionnaireTemplateOptions();
  const summaryLabels = useMemo<StepSummaryLabels>(
    () => ({
      questionnaires: Object.fromEntries(questionnaireOptions.map((o) => [o.value, o.label])),
    }),
    [questionnaireOptions],
  );

  const initialNodes = useMemo<Node<FlowNodeData>[]>(() => {
    if (!automation) return [];
    const spec = triggerIsSet ? triggerRegistry[triggerType as TriggerType] : null;

    const triggerNode: Node<FlowNodeData> = {
      id: TRIGGER_NODE_ID,
      type: 'flowNode',
      position: layout.trigger,
      deletable: false,
      zIndex: expandedId === TRIGGER_NODE_ID ? EXPANDED_Z : CARD_Z,
      data: triggerIsSet
        ? {
            kind: 'trigger',
            nodeId: TRIGGER_NODE_ID,
            title: spec?.ui.label ?? (triggerType as string),
            summary: triggerSummaryLine(filters, triggerConfig, spec?.ui.description ?? ''),
            iconName: spec?.ui.icon,
          }
        : {
            kind: 'trigger_empty',
            nodeId: TRIGGER_NODE_ID,
            title: 'Add trigger',
            summary: 'Choose what starts this automation',
          },
    };

    const actionNodes: Node<FlowNodeData>[] = actions.map((action) => ({
      id: action.id,
      type: 'flowNode',
      position: layout.actions[action.id] ?? { x: 0, y: 0 },
      zIndex: expandedId === action.id ? EXPANDED_Z : CARD_Z,
      data: {
        kind: action.type === 'branch' ? 'branch' : 'action',
        nodeId: action.id,
        title: stepTitle(action),
        summary: stepSummary(action, summaryLabels),
        iconName: actionIconName(action),
        // These steps configure themselves in a modal, so the card
        // opens it straight away rather than expanding onto a button
        // that opens it.
        modalOnly: MODAL_ACTIONS.has(action.type),
        // `stop` takes no settings; `send_sms` cannot send yet, so
        // there is nothing worth configuring on either.
        noConfig: action.type === 'stop' || action.type === 'send_sms',
      },
    }));

    const addNode: Node<FlowNodeData> | null = triggerIsSet
      ? {
          id: ADD_ACTION_NODE_ID,
          type: 'flowNode',
          position: { x: tailContext.x, y: tailContext.y },
          deletable: false,
          selectable: false,
          // Behind every real card: an opened step grows downward over
          // this placeholder, and the placeholder must not cover it.
          zIndex: PLACEHOLDER_Z,
          data: { kind: 'add', nodeId: ADD_ACTION_NODE_ID, title: 'Add action', summary: '' },
        }
      : null;

    return [triggerNode, ...actionNodes, ...(addNode ? [addNode] : [])];
  }, [
    automation,
    actions,
    layout,
    triggerIsSet,
    triggerType,
    triggerConfig,
    filters,
    tailContext,
    expandedId,
    summaryLabels,
  ]);

  const initialEdges = useMemo<Edge[]>(() => {
    const topLevel = actions
      .filter((a) => !a.parent_action_id)
      .sort((a, b) => a.position - b.position);
    const edges: Edge[] = [];
    const dashed = { strokeDasharray: '4 4', stroke: 'var(--color-border)' };

    if (triggerIsSet) {
      if (topLevel[0]) {
        edges.push({
          id: `${TRIGGER_NODE_ID}->${topLevel[0].id}`,
          source: TRIGGER_NODE_ID,
          target: topLevel[0].id,
        });
      } else {
        edges.push({
          id: `${TRIGGER_NODE_ID}->add`,
          source: TRIGGER_NODE_ID,
          target: ADD_ACTION_NODE_ID,
          style: dashed,
        });
      }
    }
    for (let i = 0; i < topLevel.length - 1; i++) {
      edges.push({
        id: `${topLevel[i]!.id}->${topLevel[i + 1]!.id}`,
        source: topLevel[i]!.id,
        target: topLevel[i + 1]!.id,
      });
    }
    if (triggerIsSet && topLevel.length > 0) {
      edges.push({
        id: `${topLevel[topLevel.length - 1]!.id}->add`,
        source: topLevel[topLevel.length - 1]!.id,
        target: ADD_ACTION_NODE_ID,
        style: dashed,
      });
    }
    for (const action of actions.filter((a) => a.type === 'branch')) {
      for (const branchPath of ['yes', 'no'] as BranchPath[]) {
        const children = actions
          .filter((a) => a.parent_action_id === action.id && a.branch_path === branchPath)
          .sort((a, b) => a.position - b.position);
        if (children[0]) {
          edges.push({
            id: `${action.id}-${branchPath}->${children[0].id}`,
            source: action.id,
            sourceHandle: branchPath,
            target: children[0].id,
            label: branchPath === 'yes' ? 'Yes' : 'No',
          });
        }
        for (let i = 0; i < children.length - 1; i++) {
          edges.push({
            id: `${children[i]!.id}->${children[i + 1]!.id}`,
            source: children[i]!.id,
            target: children[i + 1]!.id,
          });
        }
      }
    }
    return edges;
  }, [actions, triggerIsSet]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  /* ── Drag → persist position ───────────────────────────────── */

  const dragPersistTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      for (const c of changes) {
        if (
          c.type === 'position' &&
          c.position &&
          c.id !== TRIGGER_NODE_ID &&
          c.id !== ADD_ACTION_NODE_ID &&
          !c.dragging
        ) {
          const id = c.id;
          const pos = c.position;
          // Mirror the drop into the local rows immediately. Without
          // this the row keeps its stale position_x/y and the next
          // setActions rebuilds from auto-layout, snapping the dragged
          // node back to where it used to be.
          setActions((prev) =>
            prev.map((a) => (a.id === id ? { ...a, position_x: pos.x, position_y: pos.y } : a)),
          );
          const existing = dragPersistTimeouts.current.get(id);
          if (existing) clearTimeout(existing);
          dragPersistTimeouts.current.set(
            id,
            setTimeout(() => {
              void updateAutomationActionPosition({
                actionId: id,
                positionX: pos.x,
                positionY: pos.y,
              }).then(() => setSavedAt(new Date()));
            }, 250),
          );
        }
      }
    },
    [onNodesChange],
  );

  const onConnect = useCallback(
    async (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      if (conn.target === ADD_ACTION_NODE_ID) return;
      setEdges((eds) => addEdge(conn, eds));
      if (conn.source === TRIGGER_NODE_ID) {
        await updateAutomationActionEdges({
          actionId: conn.target,
          parentActionId: null,
          branchPath: null,
        });
      } else {
        const branchPath = (conn.sourceHandle as BranchPath | undefined) ?? null;
        await updateAutomationActionEdges({
          actionId: conn.target,
          parentActionId: branchPath ? conn.source : null,
          branchPath,
        });
      }
      void reloadActions();
    },
    [setEdges, reloadActions],
  );

  /* ── Node interaction ──────────────────────────────────────── */

  const openTriggerPicker = useCallback((e: React.MouseEvent) => {
    setTriggerPickerAnchor({ x: e.clientX, y: e.clientY });
  }, []);

  const nodeApi = useMemo<FlowNodeApi>(
    () => ({
      expandedId,
      onToggle: (nodeId) => {
        if (nodeId === TRIGGER_NODE_ID && !triggerIsSet) return;
        setOpenedIds((prev) => (prev.has(nodeId) ? prev : new Set(prev).add(nodeId)));
        setExpandedId((current) => (current === nodeId ? null : nodeId));
      },
      onDelete: (nodeId) => {
        // Destructive, so remove optimistically and let the server
        // catch up; a failed delete surfaces on the next reload.
        setActions((prev) => prev.filter((a) => a.id !== nodeId));
        setExpandedId((current) => (current === nodeId ? null : current));
        setSavedAt(new Date());
        void deleteAutomationActionRow({ actionId: nodeId, automationId });
      },
      onChangeTrigger: openTriggerPicker,
      renderBody: (nodeId) => {
        if (!openedIds.has(nodeId)) return null;
        if (nodeId === TRIGGER_NODE_ID) {
          if (!triggerIsSet) return null;
          return (
            <TriggerCardBody
              automationId={automationId}
              triggerType={triggerType as TriggerType}
              config={triggerConfig}
              filters={filters}
              onConfigChange={handleTriggerConfigChange}
            />
          );
        }
        const action = actions.find((a) => a.id === nodeId);
        if (!action) return null;
        if (action.type === 'stop' || action.type === 'send_sms') return null;
        return (
          <StepConfigForm
            selection={{ kind: 'action', action }}
            automationId={automationId}
            {...(MODAL_ACTIONS.has(action.type)
              ? {
                  modal: {
                    open: expandedId === nodeId,
                    onClose: () => setExpandedId(null),
                  },
                }
              : {})}
            onSaved={(payload) => {
              if (payload.kind !== 'action') return;
              setActions((prev) =>
                prev.map((a) =>
                  a.id === payload.actionId ? { ...a, config: payload.config as never } : a,
                ),
              );
              setSavedAt(new Date());
            }}
          />
        );
      },
    }),
    [
      expandedId,
      openedIds,
      automationId,
      actions,
      triggerIsSet,
      triggerType,
      triggerConfig,
      filters,
      handleTriggerConfigChange,
      openTriggerPicker,
    ],
  );

  const onNodeClick = useCallback(
    (e: React.MouseEvent, node: Node) => {
      if (node.id === TRIGGER_NODE_ID && !triggerIsSet) {
        setTriggerPickerAnchor({ x: e.clientX, y: e.clientY });
        return;
      }
      if (node.id === ADD_ACTION_NODE_ID) {
        setActionPickerCtx({
          parentActionId: tailContext.parentActionId,
          branchPath: tailContext.branchPath,
          afterPosition: tailContext.afterPosition,
          positionX: tailContext.x,
          positionY: tailContext.y,
          anchor: { x: e.clientX, y: e.clientY },
        });
      }
    },
    [tailContext, triggerIsSet],
  );

  async function handleRename(name: string) {
    if (!automation || name === automation.name) return;
    await renameAutomationAction({ automationId, name });
    setAutomation((prev) => (prev ? { ...prev, name } : prev));
    setSavedAt(new Date());
  }

  async function handleToggleActive() {
    if (!automation) return;
    const next: AutomationStatus = automation.status === 'active' ? 'paused' : 'active';
    await setAutomationStatusAction({ automationId, status: next });
    setAutomation((prev) => (prev ? { ...prev, status: next } : prev));
    setSavedAt(new Date());
  }

  if (loading) return <CanvasSkeleton />;
  if (!automation) return <div className="p-8 text-text-muted">Automation not found</div>;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <CanvasHeader
        name={automation.name}
        status={automation.status}
        savedAt={savedAt}
        onBack={() => router.push('/automations')}
        onRename={handleRename}
        onToggleActive={handleToggleActive}
        onShowRuns={() => setRunsOpen(true)}
      />

      <div className="relative min-h-0 flex-1">
        <FlowNodeContext.Provider value={nodeApi}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            // Clicking the canvas closes whatever is open. An expanded
            // card overlaps the steps beneath it, and hunting for the
            // chevron you opened it with is not how anyone dismisses
            // something. Popovers inside the card portal to the body,
            // so a click in one is not a pane click and does not
            // collapse it mid-edit.
            onPaneClick={() => setExpandedId(null)}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3, maxZoom: 1, minZoom: 0.5 }}
            minZoom={0.4}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
            onNodesDelete={async (deleted) => {
              for (const n of deleted) {
                if (n.id === TRIGGER_NODE_ID || n.id === ADD_ACTION_NODE_ID) continue;
                await deleteAutomationActionRow({ actionId: n.id, automationId });
              }
              await reloadActions();
            }}
          >
            <Background gap={20} size={1} color="var(--color-border)" />
          </ReactFlow>
        </FlowNodeContext.Provider>

        {SHOW_ZEBRI_AI && (
          <AiCopilotBar
            automationId={automationId}
            automationStatus={automation.status}
            onWorkflowChanged={() => void reloadWorkflow()}
          />
        )}
      </div>

      <RunHistoryPanel
        automationId={automationId}
        actions={actions}
        open={runsOpen}
        onClose={() => setRunsOpen(false)}
      />

      {triggerPickerAnchor && (
        <TriggerPicker
          automationId={automationId}
          currentTrigger={triggerType}
          anchor={triggerPickerAnchor}
          onClose={() => setTriggerPickerAnchor(null)}
          onPicked={(next) => {
            setAutomation((prev) =>
              prev
                ? { ...prev, trigger_type: next as TriggerType, trigger_config: {} as never }
                : prev,
            );
            setTriggerPickerAnchor(null);
            setSavedAt(new Date());
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
            // upserts under that id, so the optimistic row IS the real
            // row; we only watch the promise to roll back on failure.
            setActions((prev) => [...prev, optimistic]);
            setActionPickerCtx(null);
            setSavedAt(new Date());
            void serverResult.then((res) => {
              if (!res.ok) setActions((prev) => prev.filter((a) => a.id !== optimistic.id));
            });
          }}
        />
      )}
    </div>
  );
}

/** Lucide icon name for a step, from the client-safe action catalogue. */
function actionIconName(action: AutomationActionRow): string | undefined {
  switch (action.type) {
    case 'wait':
      return 'Clock';
    case 'branch':
      return 'GitBranch';
    case 'stop':
      return 'Square';
    case 'approval':
      return 'Pause';
    case 'sub_flow':
      return 'Sparkles';
    default:
      return actionUi[action.type as ActionType]?.icon;
  }
}
