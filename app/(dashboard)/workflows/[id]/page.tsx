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
 * @module app/(dashboard)/workflows/[id]/page
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
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { actionUi } from '@/lib/automations/actions/ui';
import { triggerRegistry } from '@/lib/automations/triggers';
import { createClient } from '@/lib/supabase/client';
import { isAutomated, splitStepType } from '@/lib/workflows/steps';
import { isDefaultTiming, shortTiming, toStepTiming } from '@/lib/workflows/timing-summary';
import type {
  ActionType,
  AutomationRow,
  AutomationActionRow,
  BranchPath,
  TriggerType,
} from '@/types/automations';
import type { TemplateStatus } from '@/types/workflows';

import {
  deleteTemplateStepRow,
  renameTemplateAction,
  setTemplateStatusAction,
  setApplyRuleAction,
  updateTemplateStepEdges,
  updateTemplateStepPosition,
} from '../actions';

import {
  toBuilderStep,
  toBuilderTemplate,
  type StoredTemplate,
  type StoredTemplateStep,
} from './adapt';
import { AiCopilotBar } from './ai-copilot-bar';
import { TriggerCardBody, triggerSummaryLine, useTriggerFilters } from './apply-rule-card-body';
import { TriggerPicker } from './apply-rule-picker';
import { ROW_GAP, autoLayout } from './auto-layout';
import { CanvasHeader } from './canvas-header';
import { CanvasLegend } from './canvas-legend';
import { CanvasSkeleton } from './canvas-skeleton';
import { useQuestionnaireTemplateOptions } from './filter-options';
import { FlowNode, FlowNodeContext, type FlowNodeApi, type FlowNodeData } from './flow-node';
import { MODAL_ACTIONS, StepConfigForm } from './inspector-panel';
import { RunHistoryPanel } from './instances-panel';
import { MobileStepList, type MobileStepItem } from './mobile-step-list';
import { ActionPicker } from './step-picker';
import { stepSummary, stepTitle, type StepSummaryLabels } from './step-summary';
import { useNarrowViewport } from './use-narrow-viewport';

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
  // Set by the "describe your process" entry on the empty library: the MC
  // typed it there, and retyping it on arrival would be the whole point
  // of that screen thrown away.
  //
  // Captured once, in a state initialiser, and then wiped from the URL
  // below. It is a one-shot handoff, not a durable part of the address:
  // left in the query string it re-sent itself on every reload, and
  // since these prompts BUILD things, each refresh quietly ran the whole
  // "add these six steps" turn again against the same workflow.
  const describeParam = useSearchParams().get('describe');
  const [openingPrompt] = useState<string | undefined>(() => describeParam ?? undefined);
  const router = useRouter();
  const templateId = params.id;

  // Drop it the moment it has been read. `replace`, not `push`: the
  // address with the prompt in it must not be somewhere the back button
  // can return to either.
  useEffect(() => {
    if (describeParam) router.replace(`/workflows/${templateId}`, { scroll: false });
  }, [describeParam, router, templateId]);
  // A phone gets the list rather than the canvas. Rendered as a swap
  // rather than a CSS hide: React Flow measures its container, and a
  // display:none canvas fits its view to a zero-size box.
  const narrow = useNarrowViewport();

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
    parentStepId: string | null;
    branchPath: BranchPath | null;
    afterPosition: number;
    positionX: number;
    positionY: number;
    anchor: { x: number; y: number };
  }>(null);

  const reloadActions = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('workflow_template_steps')
      .select('*')
      .eq('template_id', templateId)
      .order('position', { ascending: true });
    setActions(((data ?? []) as unknown as StoredTemplateStep[]).map(toBuilderStep));
    setSavedAt(new Date());
  }, [templateId]);

  // Copilot edits can touch the trigger (automation row) as well as
  // the steps, so its refresh callback reloads both.
  const reloadWorkflow = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('workflow_templates')
      .select('*')
      .eq('id', templateId)
      .maybeSingle();
    if (data) setAutomation(toBuilderTemplate(data as unknown as StoredTemplate));
    await reloadActions();
  }, [templateId, reloadActions]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    setLoading(true);
    Promise.all([
      supabase.from('workflow_templates').select('*').eq('id', templateId).single(),
      supabase
        .from('workflow_template_steps')
        .select('*')
        .eq('template_id', templateId)
        .order('position', { ascending: true }),
    ]).then(([a, s]) => {
      if (cancelled) return;
      const template = a.data as unknown as StoredTemplate | null;
      setAutomation(template ? toBuilderTemplate(template) : null);
      setActions(((s.data ?? []) as unknown as StoredTemplateStep[]).map(toBuilderStep));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const applyRuleType = (automation?.trigger_type ?? 'unset') as TriggerType | 'unset';
  const triggerIsSet = applyRuleType !== 'unset';
  const applyRuleConfig = useMemo(
    () => (automation?.trigger_config as Record<string, unknown>) ?? {},
    [automation],
  );
  const filters = useTriggerFilters(applyRuleType as TriggerType, applyRuleConfig);

  /* ── Config autosave ───────────────────────────────────────── */

  // The chip UI writes whole-config patches, so the trigger's save path
  // lives here: the card body stays stateless and the page remains the
  // single owner of the automation row.
  const handleTriggerConfigChange = useCallback(
    (next: Record<string, unknown>) => {
      setAutomation((prev) => (prev ? { ...prev, trigger_config: next as never } : prev));
      setSavedAt(new Date());
      if (!triggerIsSet) return;
      void setApplyRuleAction({
        templateId,
        applyRuleType: applyRuleType as string,
        applyRuleConfig: next,
      });
    },
    [templateId, applyRuleType, triggerIsSet],
  );

  /* ── Layout → nodes / edges ────────────────────────────────── */

  const layout = useMemo(() => autoLayout(actions), [actions]);

  const tailContext = useMemo(() => {
    const topLevel = actions
      .filter((a) => !a.parent_action_id)
      .sort((a, b) => a.position - b.position);
    if (topLevel.length === 0) {
      return {
        parentStepId: null,
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
      parentStepId: null,
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
    const spec = triggerIsSet ? triggerRegistry[applyRuleType as TriggerType] : null;

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
            title: spec?.ui.label ?? (applyRuleType as string),
            summary: triggerSummaryLine(filters, applyRuleConfig, spec?.ui.description ?? ''),
            iconName: spec?.ui.icon,
          }
        : {
            kind: 'trigger_empty',
            nodeId: TRIGGER_NODE_ID,
            title: 'When does this start?',
            summary: 'Pick what puts this workflow on a couple, or start it by hand',
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
        // Scheduling is the part an MC gets wrong, so it belongs on the
        // card rather than three clicks inside the inspector.
        timingLabel: timingChipFor(action),
        needsReview: action.requires_approval === true,
        // Read off the stored (native) type, not the builder slug: the
        // canvas calls an action by its action slug ("send_email"), and
        // the step registry only knows the five native types, so asking
        // it about a slug answers "not automated" for every send.
        runsBy: isAutomated(splitStepType(action.type, {}).type) ? 'zebri' : 'you',
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
          data: { kind: 'add', nodeId: ADD_ACTION_NODE_ID, title: 'Add step', summary: '' },
        }
      : null;

    return [triggerNode, ...actionNodes, ...(addNode ? [addNode] : [])];
  }, [
    automation,
    actions,
    layout,
    triggerIsSet,
    applyRuleType,
    applyRuleConfig,
    filters,
    tailContext,
    expandedId,
    summaryLabels,
  ]);

  // The same cards the canvas draws, flattened into run order with
  // branch legs indented under their branch.
  const mobileItems = useMemo<MobileStepItem[]>(() => {
    const byId = new Map(initialNodes.map((n) => [n.id, n.data]));
    const out: MobileStepItem[] = [];
    const trigger = byId.get(TRIGGER_NODE_ID);
    if (trigger) out.push({ data: trigger, depth: 0 });

    const walk = (parentId: string | null, path: BranchPath | null, depth: number) => {
      const children = actions
        .filter(
          (a) => (a.parent_action_id ?? null) === parentId && (a.branch_path ?? null) === path,
        )
        .sort((a, b) => a.position - b.position);
      children.forEach((child, index) => {
        const data = byId.get(child.id);
        if (!data) return;
        out.push({
          data,
          depth,
          // The leg is labelled once, on the step that starts it.
          ...(path && index === 0 ? { branchLabel: path === 'yes' ? 'Yes' : 'No' } : {}),
        });
        if (child.type === 'branch') {
          walk(child.id, 'yes', depth + 1);
          walk(child.id, 'no', depth + 1);
        }
      });
    };
    walk(null, null, 0);
    return out;
  }, [initialNodes, actions]);

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
              void updateTemplateStepPosition({
                stepId: id,
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
        await updateTemplateStepEdges({
          stepId: conn.target,
          parentStepId: null,
          branchPath: null,
        });
      } else {
        const branchPath = (conn.sourceHandle as BranchPath | undefined) ?? null;
        await updateTemplateStepEdges({
          stepId: conn.target,
          parentStepId: branchPath ? conn.source : null,
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
        void deleteTemplateStepRow({ stepId: nodeId, templateId });
      },
      onChangeTrigger: openTriggerPicker,
      renderBody: (nodeId) => {
        if (!openedIds.has(nodeId)) return null;
        if (nodeId === TRIGGER_NODE_ID) {
          if (!triggerIsSet) return null;
          return (
            <TriggerCardBody
              templateId={templateId}
              applyRuleType={applyRuleType as TriggerType}
              config={applyRuleConfig}
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
            templateId={templateId}
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
                  a.id === payload.stepId
                    ? {
                        ...a,
                        config: payload.config as never,
                        // Only the manual steps send a label back; for
                        // every other step the card title is the
                        // action's own name and must not be blanked.
                        ...(payload.label === undefined
                          ? {}
                          : { label: payload.label || null }),
                      }
                    : a,
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
      templateId,
      actions,
      triggerIsSet,
      applyRuleType,
      applyRuleConfig,
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
          parentStepId: tailContext.parentStepId,
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
    await renameTemplateAction({ templateId, name });
    setAutomation((prev) => (prev ? { ...prev, name } : prev));
    setSavedAt(new Date());
  }

  async function handleToggleActive() {
    if (!automation) return;
    // Templates have no `paused`: a workflow that should stop applying
    // goes back to being a draft, which is also editable. Two states did
    // what the automations model needed three for.
    const next: TemplateStatus = automation.status === 'active' ? 'draft' : 'active';
    await setTemplateStatusAction({ templateId, status: next });
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
        onBack={() => router.push('/workflows?tab=templates')}
        onRename={handleRename}
        onToggleActive={handleToggleActive}
        onShowRuns={() => setRunsOpen(true)}
      />

      <div className="relative min-h-0 flex-1">
        <FlowNodeContext.Provider value={nodeApi}>
          {narrow ? (
            <MobileStepList
              items={mobileItems}
              api={nodeApi}
              canAdd={triggerIsSet}
              onAdd={(e) =>
                setActionPickerCtx({
                  parentStepId: tailContext.parentStepId,
                  branchPath: tailContext.branchPath,
                  afterPosition: tailContext.afterPosition,
                  positionX: tailContext.x,
                  positionY: tailContext.y,
                  anchor: { x: e.clientX, y: e.clientY },
                })
              }
            />
          ) : (
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
                  await deleteTemplateStepRow({ stepId: n.id, templateId });
                }
                await reloadActions();
              }}
            >
              <Background gap={20} size={1} color="var(--color-border)" />
            </ReactFlow>
          )}
        </FlowNodeContext.Provider>

        {/* Only worth showing once there is a flow to read. On an empty
            canvas it explains a distinction nothing on screen is making
            yet. */}
        {actions.length > 0 && <CanvasLegend />}

        {SHOW_ZEBRI_AI && (
          <AiCopilotBar
            templateId={templateId}
            automationStatus={automation.status}
            onWorkflowChanged={() => void reloadWorkflow()}
            openingPrompt={openingPrompt}
          />
        )}
      </div>

      <RunHistoryPanel templateId={templateId} open={runsOpen} onClose={() => setRunsOpen(false)} />

      {triggerPickerAnchor && (
        <TriggerPicker
          templateId={templateId}
          currentTrigger={applyRuleType}
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
          templateId={templateId}
          parentStepId={actionPickerCtx.parentStepId}
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
/**
 * The timing chip for one node, or undefined when there is nothing worth
 * saying. The default ("straight after the step above") is deliberately
 * silent: a chip on every card would be noise rather than information.
 */
function timingChipFor(action: AutomationActionRow): string | undefined {
  const timing = toStepTiming(action.timing);
  return isDefaultTiming(timing) ? undefined : shortTiming(timing);
}

function actionIconName(action: AutomationActionRow): string | undefined {
  // Cast to string: `todo` and `appointment` are stored step types, not
  // members of `ActionType`, but the builder row carries them - and
  // `actionUi` has nothing for either, so without these two cases both
  // manual steps fell through to the unknown-icon fallback (Sparkles).
  switch (action.type as string) {
    case 'todo':
      return 'CheckSquare';
    case 'appointment':
      return 'CalendarClock';
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
