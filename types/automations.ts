/**
 * Automations domain types.
 *
 * The shape of an automation, its actions, the event bus, runs, and
 * the working context the runner threads through every action.
 *
 * Mirrors the Phase 14a schema in
 * `supabase/migrations/20260604000000_create_automations_foundation.sql`.
 * Once the migration is applied locally and `supabase gen types`
 * is run, the row types here should be cross-checked against the
 * generated `Database['public']['Tables']['automations']` row
 * types to stay in sync.
 *
 * Terminology: every node in an automation's DAG is an **action**.
 * The action's `type` is the discriminator — messaging /
 * CRUD types (`send_email`, `create_task`, ...) are handled by the
 * action registry in `lib/automations/actions/`; flow-control types
 * (`wait`, `branch`, `stop`, `sub_flow`, `approval`) are handled
 * directly by the runner via `lib/automations/conditions.ts`.
 *
 * @module types/automations
 */

import type { JSONContent } from '@tiptap/react'

import type { PublicBranding } from '@/lib/branding/public-branding'

import type { Json } from './database'

// ────────────────────────────────────────────────────────────────
// Triggers
// ────────────────────────────────────────────────────────────────

/**
 * All trigger types the engine knows about.
 *
 * A trigger is the entry-point event that opens a run. The matcher
 * for each lives in `lib/automations/triggers/`.
 *
 * Time-based triggers (`time_before_event`, `time_after_event`,
 * `specific_date_reached`, `anniversary_of_event`) are emitted by
 * the tick cron itself, not by a DB trigger - there's no source
 * row that ticks past a relative-time threshold on its own.
 */
export type TriggerType =
  // Lead / enquiry
  | 'new_enquiry'
  | 'lead_inactive'
  | 'custom_field_changed'
  // Pipeline (couples)
  | 'couple_stage_changed'
  | 'booking_cancelled'
  // Quotes
  // Proposals
  | 'proposal_sent'
  | 'proposal_accepted'
  | 'proposal_declined'
  | 'proposal_due' // emitted by the tick
  | 'proposal_overdue' // emitted by the tick
  // Invoices / payments
  | 'invoice_created'
  | 'invoice_sent'
  | 'payment_received'
  | 'invoice_due' // emitted by the tick
  | 'invoice_overdue' // emitted by the tick
  | 'payment_failed'
  // Contracts
  | 'contract_created'
  | 'contract_sent'
  | 'contract_signed'
  | 'contract_declined'
  | 'contract_revoked'
  | 'contract_expired'
  | 'document_signed' // alias of contract_signed for picker UX
  // Events (the event / rehearsal / reception rows under a couple)
  | 'event_created'
  | 'event_updated'
  | 'event_deleted'
  // Calendar (emitted by the tick, anchored to event_date)
  | 'time_before_event'
  | 'time_after_event'
  | 'specific_date_reached'
  | 'anniversary_of_event'
  // Client portal
  | 'section_completed'
  | 'portal_section_started_not_finished' // emitted by the tick
  | 'timeline_edited'
  // Task
  | 'task_created'
  | 'task_completed'
  | 'task_overdue' // emitted by the tick
  // Contacts (vendors, family, bridal party)
  | 'contact_created'
  | 'contact_updated'
  | 'contact_linked_to_couple'
  // Manual
  | 'manual_fire'
  // ── Phase 14a UI scaffolding (not yet emitted) ─────────────────
  // Consultations
  | 'consultation_booked'
  | 'consultation_completed'
  | 'consultation_no_show'
  // AU paperwork / compliance milestones
  | 'noim_lodged'
  | 'noim_overdue'
  | 'donlim_due'
  | 'donlim_signed'
  | 'marriage_certificate_issued'
  | 'rehearsal_scheduled'
  | 'rehearsal_completed'
  // Engagement (inbound email / portal interaction)
  | 'couple_replied_to_email'
  | 'couple_did_not_reply'
  | 'couple_opened_email'
  | 'couple_clicked_link'
  | 'couple_email_bounced'
  | 'couple_unsubscribed'
  // Contact relationships
  | 'vendor_contact_assigned'
  // Portal interactions
  | 'couple_uploaded_file'
  | 'couple_added_song_to_playlist'
  | 'couple_completed_vows'
  | 'questionnaire_completed'
  // App / billing meta
  | 'subscription_status_changed'
  | 'subscription_trial_ending'
  | 'team_member_added'
  // Self-healing
  | 'automation_failed'
  // Inbound integrations
  | 'webhook_received'
  // Tagging
  | 'tag_added_to_couple'
  | 'tag_removed_from_couple'
  // Personal touches
  | 'couple_birthday'
  // Payment plans
  | 'payment_plan_milestone_reached'
  | 'refund_issued'
  // Privacy / compliance
  | 'couple_set_do_not_contact'
  // Onboarding
  | 'branding_published'

// ────────────────────────────────────────────────────────────────
// Actions
// ────────────────────────────────────────────────────────────────

/**
 * All action types the engine knows about.
 *
 * Each action is one node in the automation's DAG. The union splits
 * into two families:
 *
 *  - **Registered actions** — `send_email`, `create_task`, etc. Each
 *    maps to a handler in `lib/automations/actions/`. Handlers
 *    receive the run context plus a parsed type-specific config and
 *    return an {@link ActionResult}.
 *  - **Flow-control actions** — `wait`, `branch`, `stop`, `sub_flow`,
 *    `approval`. Handled directly by the runner via
 *    `lib/automations/conditions.ts`; they don't appear in the action
 *    registry.
 *
 * Channel-specific actions (`send_sms`, `send_whatsapp`) are
 * surfaced in the picker as "Coming soon" tiles in 14a and wired
 * in 14b.
 */
export type ActionType =
  // General messaging
  | 'send_email'
  | 'send_sms' // 14b
  | 'send_whatsapp' // 14b
  // Tasks
  | 'create_task'
  | 'update_task'
  // Couple
  | 'create_couple'
  | 'add_note'
  | 'update_couple_stage'
  | 'send_portal_link'
  | 'request_information'
  | 'send_onboarding_pack'
  | 'send_pre_event_checklist'
  | 'create_timeline_event'
  | 'update_timeline_event'
  | 'send_timeline_to_vendors'
  | 'send_final_run_sheet'
  | 'update_custom_fields'
  // Calendar
  | 'create_calendar_event'
  | 'create_reminder'
  // Payments
  | 'send_proposal'
  | 'send_contract'
  | 'send_invoice'
  // Couple questionnaires
  | 'send_couple_questionnaire'
  | 'trigger_payment_reminder'
  // Post-event
  | 'send_thank_you_message'
  | 'request_review'
  | 'send_referral_request'
  | 'send_anniversary_message'
  // Recommended additions
  | 'pause_couple_automations'
  | 'generate_run_sheet_pdf'
  // ── Phase 14a UI scaffolding (handlers not wired) ──────────────
  // Consultation / calendar
  | 'create_consultation'
  | 'cancel_consultation'
  | 'block_calendar_slot'
  | 'unblock_calendar_slot'
  | 'send_calendar_invite'
  // AU paperwork
  | 'lodge_noim_reminder'
  | 'generate_noim_pdf'
  | 'generate_donlim_pdf'
  | 'generate_marriage_certificate'
  | 'lodge_bdm_paperwork'
  // Tagging + segmentation
  | 'assign_tag'
  | 'remove_tag'
  | 'update_lead_score'
  | 'add_to_segment'
  | 'remove_from_segment'
  | 'enqueue_for_newsletter'
  // Payments
  | 'create_invoice_from_proposal'
  | 'create_contract_from_template'
  | 'void_invoice'
  | 'revoke_contract'
  | 'apply_discount'
  | 'add_line_item'
  | 'send_payment_link'
  | 'record_offline_payment'
  | 'request_payment_method_update'
  // Couple
  | 'assign_contact_to_couple'
  | 'request_vendor_confirmation'
  | 'escalate_to_phone_call'
  | 'mark_couple_as_lost'
  | 'share_portal_section_with_vendor'
  | 'clone_couple_to_new_event'
  | 'merge_couples'
  | 'archive_couple'
  | 'export_couple_data'
  // Drip / sequence flow control
  | 'start_drip_campaign'
  | 'pause_drip_campaign'
  | 'resume_drip_campaign'
  | 'pause_sequence'
  | 'resume_sequence'
  | 'goto_step'
  // Integrations (outbound)
  | 'send_to_slack'
  | 'send_to_webhook'
  | 'add_to_zapier'
  // Notifications
  | 'notify_couple_via_push'
  // Print / batch
  | 'print_label_for_certificate'
  // Flow control (no registry entry — runner-evaluated)
  | 'wait'
  | 'branch'
  | 'stop'
  | 'sub_flow'
  | 'approval'

/**
 * Subset of {@link ActionType} that the runner evaluates inline
 * rather than dispatching through the action registry. Useful for
 * narrowing in the runner's switch statement.
 */
export type FlowControlActionType = 'wait' | 'branch' | 'stop' | 'sub_flow' | 'approval'

/**
 * The five flow-control action types as a runtime array. Use this
 * to test `actionType in FLOW_CONTROL_ACTION_TYPES` style guards.
 */
export const FLOW_CONTROL_ACTION_TYPES: readonly FlowControlActionType[] = [
  'wait',
  'branch',
  'stop',
  'sub_flow',
  'approval',
]

// ────────────────────────────────────────────────────────────────
// Action rows
// ────────────────────────────────────────────────────────────────

export type BranchPath = 'yes' | 'no'

export type AutomationStatus = 'draft' | 'active' | 'paused' | 'archived'
export type RunStatus = 'running' | 'waiting' | 'paused' | 'completed' | 'errored' | 'cancelled'
export type WaitReason = 'wait' | 'approval' | 'quiet_hours' | 'missing_variables'

export interface AutomationRow {
  id: string
  user_id: string
  name: string
  description: string | null
  trigger_type: TriggerType
  trigger_config: Json
  status: AutomationStatus
  template_slug: string | null
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  branch_depth_limit: number
  version: number
  created_at: string
  updated_at: string
}

/**
 * One node in an automation's DAG. The `type` discriminates between
 * the registered action handlers and the runner-evaluated
 * flow-control actions; `config` carries the per-type config shape.
 */
export interface AutomationActionRow {
  id: string
  automation_id: string
  position: number
  type: ActionType
  config: Json
  parent_action_id: string | null
  branch_path: BranchPath | null
  label: string | null
  disabled: boolean
  /** Canvas x coordinate. NULL until first drag (auto-layout fills it visually). */
  position_x: number | null
  /** Canvas y coordinate. NULL until first drag. */
  position_y: number | null
  created_at: string
  updated_at: string
}

export interface AutomationEventRow {
  id: string
  user_id: string
  source_table: string
  source_id: string | null
  event_type: TriggerType
  payload: Json
  couple_id: string | null
  created_at: string
  processed_at: string | null
  error_message: string | null
}

export interface AutomationRunRow {
  id: string
  automation_id: string
  event_id: string
  user_id: string
  couple_id: string | null
  status: RunStatus
  current_action_id: string | null
  started_at: string
  completed_at: string | null
  error_message: string | null
  last_payload: Json
}

export interface AutomationWaitRow {
  id: string
  run_id: string
  action_id: string
  user_id: string
  wake_at: string
  reason: WaitReason
  payload: Json
  token: string | null
  consumed_at: string | null
  created_at: string
}

export interface AutomationAuditLogRow {
  id: string
  automation_id: string
  run_id: string | null
  action_id: string | null
  user_id: string
  event:
    | 'run_started'
    | 'action_started'
    | 'action_completed'
    | 'action_skipped'
    | 'action_errored'
    | 'run_paused'
    | 'run_resumed'
    | 'run_completed'
    | 'run_cancelled'
    | 'run_errored'
    | 'approval_requested'
    | 'approval_granted'
    | 'approval_denied'
    | 'approval_timeout'
    | 'quiet_hours_deferred'
    | 'missing_variables_detected'
  details: Json
  created_at: string
}

export interface CoupleCustomFieldRow {
  id: string
  couple_id: string
  user_id: string
  key: string
  value: Json
  created_at: string
  updated_at: string
}

// ────────────────────────────────────────────────────────────────
// Recipients
// ────────────────────────────────────────────────────────────────

/**
 * Recipient role within a couple's people graph.
 *
 * The recipient picker on every send-* action exposes these as
 * built-in roles. Custom-tag handling layers a string slug on top.
 */
export type RecipientRole = 'primary' | 'spouse' | 'family' | 'vendor' | 'custom' | 'me'

export interface RecipientSpec {
  /** One or more roles to address. Multi-select. */
  roles: RecipientRole[]
  /** When role = 'custom', the tag slug to match against contact_tags. */
  customTag?: string
  /**
   * Fallback rule when the requested roles can't be resolved
   * (no spouse email, no family contacts, etc.). 'primary_only'
   * sends to the primary couple email; 'skip' skips the action;
   * 'error' fails the run.
   */
  fallback: 'primary_only' | 'skip' | 'error'
}

/**
 * Concrete recipient resolved at run-time. Used by the email /
 * SMS / WhatsApp send actions.
 */
export interface ResolvedRecipient {
  role: RecipientRole
  /** The contact / couple row id. NULL for the primary couple email. */
  contactId: string | null
  name: string
  email: string | null
  phone: string | null
  /** True if the fallback rule was hit when resolving this entry. */
  fallbackApplied: boolean
}

// ────────────────────────────────────────────────────────────────
// Runner working context
// ────────────────────────────────────────────────────────────────

/**
 * The working context the runner threads through every action
 * handler. Includes the triggering event, the couple's denormalised
 * profile, the event date (if any), the MC's branding, and an
 * accumulator of prior action results that later actions can
 * reference.
 */
export interface RunContext {
  userId: string
  automationId: string
  runId: string
  coupleId: string | null
  triggerEvent: AutomationEventRow

  /** Pre-resolved couple snapshot for use by variable + recipient resolvers. */
  couple: CoupleSnapshot | null

  /**
   * Invoice snapshot for payment-related conditions and variables.
   * Resolved based on triggerEvent.payload.invoice_id (if present) or the
   * couple's most recent non-cancelled invoice. Null if neither resolves.
   */
  invoice: InvoiceSnapshot | null

  /** The MC's profile / branding for `{{mc.*}}` variables. */
  mc: McSnapshot

  /** Outputs from previously executed actions, keyed by action id. */
  actionResults: Record<string, Json>
}

export interface CoupleSnapshot {
  id: string
  name: string
  email: string | null
  phone: string | null
  eventDate: string | null
  venue: string | null
  status: string
  primaryName: string
  spouseName: string | null
  spouseEmail: string | null
  spousePhone: string | null
  /** Couple-local IANA timezone for quiet-hours math. */
  timezone: string
}

/**
 * Invoice snapshot for automation conditions.
 *
 * Carries the invoice id and the paid_at timestamp of its first
 * (lowest position) payment stage. Used by the has_paid_deposit
 * condition to determine if the couple has settled the initial
 * payment milestone.
 */
export interface InvoiceSnapshot {
  id: string
  /** paid_at timestamp of the first (position=1) stage, or null if unpaid. */
  firstStagePaidAt: string | null
}

export interface McSnapshot {
  userId: string
  businessName: string
  contactName: string
  email: string
  phone: string | null
  brandColor: string | null
  logoUrl: string | null
  /** Quiet-hours workspace defaults (user_metadata). */
  quietHoursStart: string | null
  quietHoursEnd: string | null
  quietHoursTimezone: string | null
  /**
   * The MC's configured email signature (Settings → Signature), a TipTap
   * JSON doc that may itself contain `{{mc.*}}` / `{{couple.*}}` mentions.
   * `null` when unset. Surfaced to templates via the `{{mc.signature}}`
   * variable: rich HTML in an email body, flattened to plain text in a
   * subject or plain-text channel.
   */
  signature?: JSONContent | null
  /**
   * The MC's resolved branding (colours, fonts, logo, radius) assembled
   * from `user_metadata` via `buildPublicBranding`. Drives the branded
   * email shell so previews and sends look identical. Optional so older
   * fixtures still typecheck; a missing value gets the neutral shell.
   */
  branding?: PublicBranding | null
}

// ────────────────────────────────────────────────────────────────
// Action result
// ────────────────────────────────────────────────────────────────

/**
 * The shape an action handler returns to the runner.
 *
 * `ok` means the action completed; `output` is merged into the
 * run's actionResults so later actions can reference it. `error`
 * means the action failed; the runner records the error and
 * transitions the run to errored. `sleep` means the action needs
 * to come back at a later time (used by wait + approval +
 * quiet_hours).
 */
export type ActionResult =
  | { kind: 'ok'; output?: Json }
  | { kind: 'error'; message: string; recoverable?: boolean }
  | {
      kind: 'sleep'
      wakeAt: string
      reason: WaitReason
      token?: string
      payload?: Json
    }

// ────────────────────────────────────────────────────────────────
// Flow-control action config shapes (parsed via Zod in conditions.ts)
// ────────────────────────────────────────────────────────────────

/**
 * Flow-control configs only. Registered-action configs are
 * per-action and live alongside their handlers in
 * `lib/automations/actions/`.
 */
export type FlowControlConfig =
  | WaitActionConfig
  | BranchActionConfig
  | StopActionConfig
  | SubFlowActionConfig
  | ApprovalActionConfig

export type WaitMode = 'duration' | 'until_date' | 'relative_to_event'

export interface WaitActionConfig {
  mode: WaitMode
  /** When mode = 'duration': minutes from now. */
  durationMinutes?: number
  /** When mode = 'until_date': ISO date. */
  untilDate?: string
  /** When mode = 'relative_to_event'. */
  relative?: {
    amount: number
    unit: 'minutes' | 'hours' | 'days' | 'weeks'
    direction: 'before' | 'after'
    anchor: 'event_date'
  }
  /** Respect the workspace's quiet-hours window. */
  respectQuietHours?: boolean
}

export interface BranchActionConfig {
  predicate: BranchPredicate
}

/**
 * Predicate for if/else. Kept as a tagged union so the
 * predicate evaluator can pattern-match without ambiguity.
 */
export type BranchPredicate =
  | { kind: 'couple_field'; field: string; op: ComparisonOp; value: Json }
  | { kind: 'event_in'; op: '<' | '<=' | '>' | '>='; days: number }
  | { kind: 'has_paid_deposit' }
  | { kind: 'has_signed_contract' }
  | { kind: 'custom_field'; key: string; op: ComparisonOp; value: Json }
  | { kind: 'and'; predicates: BranchPredicate[] }
  | { kind: 'or'; predicates: BranchPredicate[] }
  | { kind: 'not'; predicate: BranchPredicate }

export type ComparisonOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'is_set' | 'is_unset'

export interface StopActionConfig {
  reason?: string
}

export interface SubFlowActionConfig {
  automationId: string
}

export interface ApprovalActionConfig {
  prompt: string
  expiresInDays: number
  /** Address to email the approval prompt to. */
  approverEmail: string
}

// ────────────────────────────────────────────────────────────────
// Labels (UI helpers)
// ────────────────────────────────────────────────────────────────

export const TRIGGER_CATEGORIES = [
  { slug: 'lead', label: 'Lead & enquiry' },
  { slug: 'pipeline', label: 'Pipeline' },
  { slug: 'payment', label: 'Quotes, invoices & payments' },
  { slug: 'contract', label: 'Contracts' },
  { slug: 'calendar', label: 'Calendar & events' },
  { slug: 'consultation', label: 'Consultations' },
  { slug: 'portal', label: 'Client portal' },
  { slug: 'task', label: 'Tasks' },
  { slug: 'contact', label: 'Contacts (vendors, family)' },
  { slug: 'engagement', label: 'Engagement (opens, replies, clicks)' },
  { slug: 'compliance', label: 'Compliance & paperwork (AU)' },
  { slug: 'billing', label: 'Subscription & billing' },
  { slug: 'integration', label: 'Inbound integrations' },
  { slug: 'meta', label: 'Meta / self-healing' },
  { slug: 'manual', label: 'Manual' },
] as const

export const ACTION_CATEGORIES = [
  { slug: 'general', label: 'General' },
  { slug: 'couple', label: 'Couple' },
  { slug: 'calendar', label: 'Calendar' },
  { slug: 'consultation', label: 'Consultations' },
  { slug: 'payments', label: 'Payments' },
  { slug: 'compliance', label: 'Compliance & paperwork (AU)' },
  { slug: 'segmentation', label: 'Tags & segmentation' },
  { slug: 'integration', label: 'Integrations (outbound)' },
  { slug: 'post_event', label: 'Post-event' },
  { slug: 'flow', label: 'Flow control' },
] as const

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  running: 'Running',
  waiting: 'Waiting',
  paused: 'Paused',
  completed: 'Completed',
  errored: 'Errored',
  cancelled: 'Cancelled',
}

// ────────────────────────────────────────────────────────────────
// /automations home payload - the single batched read the list
// page loads on mount
// ────────────────────────────────────────────────────────────────

/**
 * A row in the list, enriched with the per-automation aggregates
 * the home page surfaces (run count, last-fired timestamp, next
 * scheduled wake-up, and a human-readable trigger label).
 */
export interface EnrichedAutomationRow extends AutomationRow {
  runCount: number
  completedCount: number
  erroredCount: number
  /** Success rate as a 0–1 ratio, or `null` when there's no completed/errored data to compute. */
  successRate: number | null
  lastFiredAt: string | null
  nextWakeAt: string | null
  triggerLabel: string
}

/**
 * Couple with running / waiting automations, plus the next time
 * one of those automations will resume. Drives the "Couples in
 * active flows" subsection.
 */
export interface CoupleInFlow {
  coupleId: string
  coupleName: string
  runningCount: number
  nextWakeAt: string | null
}

/**
 * One row of the recent-activity feed (collapsed by default on
 * the page). Built from `automation_audit_log` filtered to
 * `event = 'action_completed'`.
 */
export interface RecentActivityRow {
  id: string
  when: string
  automationName: string
  coupleName: string | null
  summary: string
}

/**
 * The single payload returned by `loadAutomationsHomeAction`. All
 * four sections of the /automations home page are computed from
 * this shape - no per-section secondary queries.
 */
export interface AutomationsHomePayload {
  stats: {
    actionsThisWeek: number
    upcoming: number
    active: number
    erroredLast7d: number
    /** Total automations (drives the "show filters?" threshold). */
    totalAutomations: number
  }
  /** First errored automation in the last 7 days - used by the health banner. */
  firstErrorAutomationId: string | null
  firstErrorAutomationName: string | null
  upcomingForCouples: CoupleInFlow[]
  automations: EnrichedAutomationRow[]
  recentActivity: RecentActivityRow[]
}
