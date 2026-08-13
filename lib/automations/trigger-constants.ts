/**
 * Shared constant lists used by trigger config schemas (Zod enums)
 * AND the inspector form Selects. Kept in one place so the picker
 * UI and the dispatcher's match logic never drift.
 *
 * @module lib/automations/trigger-constants
 */

/** Event types — the categories on `events.event_type` (ceremony / reception / rehearsal / etc.). */
export const EVENT_TYPES = [
  'ceremony',
  'rehearsal',
  'reception',
  'send_off',
  'engagement',
  'other',
] as const
export type EventTypeSlug = (typeof EVENT_TYPES)[number]

export const EVENT_TYPE_LABELS: Record<EventTypeSlug, string> = {
  ceremony: 'Ceremony',
  rehearsal: 'Rehearsal',
  reception: 'Reception',
  send_off: 'Send-off',
  engagement: 'Engagement party',
  other: 'Other',
}

/** Portal sections the couple fills in. */
export const PORTAL_SECTIONS = ['people', 'songs', 'files', 'timeline'] as const
export type PortalSection = (typeof PORTAL_SECTIONS)[number]

export const PORTAL_SECTION_LABELS: Record<PortalSection, string> = {
  people: 'People (family, partner, bridal party)',
  songs: 'Music & song requests',
  files: 'Files & documents',
  timeline: 'Timeline / run sheet',
}

/** People-category slugs inside the `people` portal section. */
export const PEOPLE_CATEGORIES = ['partner', 'family', 'bridal_party'] as const
export type PeopleCategory = (typeof PEOPLE_CATEGORIES)[number]

export const PEOPLE_CATEGORY_LABELS: Record<PeopleCategory, string> = {
  partner: 'Partner',
  family: 'Family',
  bridal_party: 'Bridal party',
}

/** Vendor / contact categories — matches the `contacts.category` enum. */
export const CONTACT_CATEGORIES = [
  'venue',
  'celebrant',
  'photographer',
  'videographer',
  'dj',
  'florist',
  'hair_makeup',
  'caterer',
  'photo_booth',
  'lighting_av',
  'planner',
  'other',
] as const
export type ContactCategory = (typeof CONTACT_CATEGORIES)[number]

export const CONTACT_CATEGORY_LABELS: Record<ContactCategory, string> = {
  venue: 'Venue',
  celebrant: 'Celebrant',
  photographer: 'Photographer',
  videographer: 'Videographer',
  dj: 'DJ',
  florist: 'Florist',
  hair_makeup: 'Hair & makeup',
  caterer: 'Caterer',
  photo_booth: 'Photo booth',
  lighting_av: 'Lighting / AV',
  planner: 'Planner',
  other: 'Other',
}

/**
 * Lead sources, re-exported from the couple domain module.
 *
 * These are not a free list of channels an MC might imagine: they are
 * exactly the values that can end up in `couples.lead_source`. Only two
 * writers exist: the couple modal (which offers this list) and
 * `submit_lead()` (which hard-codes `'website'`). An automation filter
 * offering anything else would be a filter that can never match, so the
 * enum lives in one place and both sides read it.
 */
export { LEAD_SOURCES, LEAD_SOURCE_LABELS } from '@/types/couple'
export type { LeadSource } from '@/types/couple'

/** Time units used by amount + unit triggers. */
export const TIME_UNITS = ['minutes', 'hours', 'days', 'weeks'] as const
export type TimeUnit = (typeof TIME_UNITS)[number]

export const TIME_UNIT_LABELS: Record<TimeUnit, string> = {
  minutes: 'Minutes',
  hours: 'Hours',
  days: 'Days',
  weeks: 'Weeks',
}

/** Day-of-week slugs for filtering event triggers (Sat/Sun vs weekday). */
export const DAY_OF_WEEK_BUCKETS = ['any', 'weekend', 'weekday', 'saturday', 'sunday', 'friday'] as const
export type DayOfWeekBucket = (typeof DAY_OF_WEEK_BUCKETS)[number]

export const DAY_OF_WEEK_LABELS: Record<DayOfWeekBucket, string> = {
  any: 'Any day',
  weekend: 'Weekend (Sat & Sun)',
  weekday: 'Weekday (Mon-Fri)',
  saturday: 'Saturday only',
  sunday: 'Sunday only',
  friday: 'Friday only',
}

/**
 * Resolves whether an ISO date string falls in the requested
 * day-of-week bucket. Used by the event_* and time_*_event match
 * functions. Returns true when the bucket is 'any' or the input
 * date can't be parsed - "absent filter" semantics.
 */
export function dateMatchesDayOfWeek(isoDate: string | null | undefined, bucket: DayOfWeekBucket): boolean {
  if (bucket === 'any') return true
  if (!isoDate) return true
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return true
  const dow = d.getUTCDay() // 0 = Sun
  switch (bucket) {
    case 'weekend': return dow === 0 || dow === 6
    case 'weekday': return dow >= 1 && dow <= 5
    case 'saturday': return dow === 6
    case 'sunday': return dow === 0
    case 'friday': return dow === 5
  }
}

/** Numeric comparison operators used by min/max amount + days filters. */
/**
 * Every comparison the matcher understands. Kept complete so a config
 * saved against `gt` / `lt` / `eq` still parses **and still matches**
 * — they simply left the picker (see {@link OFFERED_COMPARISON_OPS}).
 */
export const COMPARISON_OPS = ['gte', 'gt', 'lte', 'lt', 'eq'] as const
export type ComparisonOp = (typeof COMPARISON_OPS)[number]

export const COMPARISON_OP_LABELS: Record<ComparisonOp, string> = {
  gte: 'at least',
  gt: 'more than',
  lte: 'at most',
  lt: 'less than',
  eq: 'exactly',
}

/**
 * The comparisons a numeric filter actually offers.
 *
 * `gt` and `lt` are dropped as off-by-one twins of `gte` / `lte` —
 * nobody setting up "invoices over $2,000" is distinguishing $2,000
 * from $2,000.01, and showing both makes a reader stop to work out
 * whether the boundary is included.
 *
 * The three kept all earn their place. "The wedding is inside 90
 * days" and "the wedding is still over a year out" are different
 * automations, and `eq` pins an exact figure — a fixed package price,
 * a specific day count. Note it is a narrow instrument on a date: a
 * trigger firing on a couple's activity only matches `eq` when that
 * activity lands on precisely the configured day.
 */
export const OFFERED_COMPARISON_OPS = ['lte', 'gte', 'eq'] as const

export function compareNumber(actual: number, op: ComparisonOp, threshold: number): boolean {
  switch (op) {
    case 'gte': return actual >= threshold
    case 'gt': return actual > threshold
    case 'lte': return actual <= threshold
    case 'lt': return actual < threshold
    case 'eq': return actual === threshold
  }
}

/**
 * Sentinel value used by the design-system Select to represent
 * "no filter" (Radix doesn't allow empty-string values). Form code
 * maps this back to `undefined` before saving config.
 */
export const ANY_SENTINEL = '__any__'

// ────────────────────────────────────────────────────────────────
// Extended enums (Phase 14a UI scaffolding — see audit table)
//
// Backend logic for triggers/actions that depend on these enums
// is not yet wired; the values exist so the inspector can render
// the configuration affordances surfaced by the audit. Adding
// behaviour later just means reading these slugs in match() /
// handler() — the picker, schemas, and forms already speak them.
// ────────────────────────────────────────────────────────────────

/** Calendar month slug (used for season / peak-month filters). */
export const MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
] as const
export type Month = (typeof MONTHS)[number]

export const MONTH_LABELS: Record<Month, string> = {
  jan: 'January', feb: 'February', mar: 'March', apr: 'April',
  may: 'May', jun: 'June', jul: 'July', aug: 'August',
  sep: 'September', oct: 'October', nov: 'November', dec: 'December',
}

/** Coarse wedding-season buckets — peak/shoulder/off in AU. */
export const SEASONS = ['any', 'peak', 'shoulder', 'off'] as const
export type Season = (typeof SEASONS)[number]

export const SEASON_LABELS: Record<Season, string> = {
  any: 'Any season',
  peak: 'Peak (Oct–Apr)',
  shoulder: 'Shoulder (May, Sep)',
  off: 'Off (Jun–Aug)',
}

/**
 * Month slug of an ISO date, or `null` when the date is absent or
 * unparseable.
 *
 * Read in UTC to agree with {@link dateMatchesDayOfWeek}: a `date`
 * column serialises as `YYYY-MM-DD`, which parses to UTC midnight, so
 * a local-time read would shift the month for anyone west of UTC on
 * the first of the month.
 */
export function monthOfDate(isoDate: string | null | undefined): Month | null {
  if (!isoDate) return null
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return null
  return MONTHS[d.getUTCMonth()] ?? null
}

/**
 * AU wedding-season bucket of an ISO date, or `null` when the date is
 * absent or unparseable. Never returns `'any'`, since that slug means "no
 * filter", not a season a date can fall in.
 */
export function seasonOfDate(isoDate: string | null | undefined): Exclude<Season, 'any'> | null {
  if (!isoDate) return null
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return null
  const month = d.getUTCMonth() + 1
  if (month === 5 || month === 9) return 'shoulder'
  if (month >= 6 && month <= 8) return 'off'
  return 'peak'
}

/** Stripe-style payment failure reasons surfaced to the picker. */
export const PAYMENT_FAILURE_REASONS = [
  'card_declined',
  'insufficient_funds',
  'expired_card',
  'authentication_required',
  'other',
] as const
export type PaymentFailureReason = (typeof PAYMENT_FAILURE_REASONS)[number]

export const PAYMENT_FAILURE_REASON_LABELS: Record<PaymentFailureReason, string> = {
  card_declined: 'Card declined',
  insufficient_funds: 'Insufficient funds',
  expired_card: 'Expired card',
  authentication_required: '3DS / authentication required',
  other: 'Other',
}

/** Tone tiers used by payment / chase emails. */
export const REMINDER_TONES = ['friendly', 'firm', 'final'] as const
export type ReminderTone = (typeof REMINDER_TONES)[number]

export const REMINDER_TONE_LABELS: Record<ReminderTone, string> = {
  friendly: 'Friendly nudge',
  firm: 'Firm reminder',
  final: 'Final notice',
}

/** Review platforms an MC might point a couple at. */
export const REVIEW_PLATFORMS = [
  'google',
  'easy_weddings',
  'abia',
  'wedsites',
  'wedding_wire',
  'facebook',
  'other',
] as const
export type ReviewPlatform = (typeof REVIEW_PLATFORMS)[number]

export const REVIEW_PLATFORM_LABELS: Record<ReviewPlatform, string> = {
  google: 'Google',
  easy_weddings: 'Easy Weddings',
  abia: 'ABIA',
  wedsites: 'WedSites',
  wedding_wire: 'WeddingWire',
  facebook: 'Facebook',
  other: 'Other',
}

/** Consultation types — discovery / planning / rehearsal / etc. */
export const CONSULTATION_TYPES = [
  'discovery',
  'planning',
  'rehearsal',
  'final_meeting',
  'other',
] as const
export type ConsultationType = (typeof CONSULTATION_TYPES)[number]

export const CONSULTATION_TYPE_LABELS: Record<ConsultationType, string> = {
  discovery: 'Discovery call',
  planning: 'Planning meeting',
  rehearsal: 'Rehearsal',
  final_meeting: 'Final pre-event meeting',
  other: 'Other',
}

/** Outcome of a consultation meeting. */
export const CONSULTATION_OUTCOMES = [
  'booked',
  'declined',
  'undecided',
  'rescheduled',
] as const
export type ConsultationOutcome = (typeof CONSULTATION_OUTCOMES)[number]

export const CONSULTATION_OUTCOME_LABELS: Record<ConsultationOutcome, string> = {
  booked: 'Booked',
  declined: 'Declined',
  undecided: 'Undecided',
  rescheduled: 'Rescheduled',
}

/** Consultation location / format. */
export const CONSULTATION_LOCATIONS = ['in_person', 'video', 'phone'] as const
export type ConsultationLocation = (typeof CONSULTATION_LOCATIONS)[number]

export const CONSULTATION_LOCATION_LABELS: Record<ConsultationLocation, string> = {
  in_person: 'In person',
  video: 'Video call',
  phone: 'Phone call',
}

/** Fields a couple's portal/section completion can be filtered by. */
export const PORTAL_COMPLETION_RANGES = [
  'lt_25',
  '25_to_50',
  '50_to_75',
  'gt_75',
] as const
export type PortalCompletionRange = (typeof PORTAL_COMPLETION_RANGES)[number]

export const PORTAL_COMPLETION_RANGE_LABELS: Record<PortalCompletionRange, string> = {
  lt_25: 'Less than 25%',
  '25_to_50': '25–50%',
  '50_to_75': '50–75%',
  gt_75: 'More than 75%',
}

/** Fields the event_updated `changed` filter can pick. */
export const EVENT_CHANGE_FIELDS = [
  'any',
  'date',
  'venue',
  'guest_count',
  'ceremony_type',
  'start_time',
  'notes',
] as const
export type EventChangeField = (typeof EVENT_CHANGE_FIELDS)[number]

export const EVENT_CHANGE_FIELD_LABELS: Record<EventChangeField, string> = {
  any: 'Anything changed',
  date: 'Date',
  venue: 'Venue',
  guest_count: 'Guest count',
  ceremony_type: 'Ceremony type',
  start_time: 'Start time',
  notes: 'Notes',
}

/** AU paperwork milestone slugs (NOIM, DONLIM, certificates). */
export const COMPLIANCE_MILESTONES = [
  'noim_lodged',
  'noim_overdue',
  'donlim_due',
  'donlim_signed',
  'marriage_certificate_issued',
  'bdm_lodged',
] as const
export type ComplianceMilestone = (typeof COMPLIANCE_MILESTONES)[number]

export const COMPLIANCE_MILESTONE_LABELS: Record<ComplianceMilestone, string> = {
  noim_lodged: 'NOIM lodged',
  noim_overdue: 'NOIM overdue',
  donlim_due: 'DONLIM due',
  donlim_signed: 'DONLIM signed',
  marriage_certificate_issued: 'Marriage certificate issued',
  bdm_lodged: 'BDM paperwork lodged',
}

/** Email engagement signal type (open / click / reply / bounce). */
export const EMAIL_ENGAGEMENT_KINDS = [
  'opened',
  'clicked',
  'replied',
  'bounced',
  'unsubscribed',
] as const
export type EmailEngagementKind = (typeof EMAIL_ENGAGEMENT_KINDS)[number]

export const EMAIL_ENGAGEMENT_KIND_LABELS: Record<EmailEngagementKind, string> = {
  opened: 'Opened',
  clicked: 'Clicked a link',
  replied: 'Replied',
  bounced: 'Bounced',
  unsubscribed: 'Unsubscribed',
}

/** Source of an inbound webhook event the engine can react to. */
export const WEBHOOK_SOURCES = [
  'calendly',
  'typeform',
  'website_form',
  'zapier',
  'make',
  'easy_weddings',
  'wedding_wire',
  'other',
] as const
export type WebhookSource = (typeof WEBHOOK_SOURCES)[number]

export const WEBHOOK_SOURCE_LABELS: Record<WebhookSource, string> = {
  calendly: 'Calendly',
  typeform: 'Typeform',
  website_form: 'Website form',
  zapier: 'Zapier',
  make: 'Make.com',
  easy_weddings: 'Easy Weddings',
  wedding_wire: 'WeddingWire',
  other: 'Other webhook',
}

/** Slack channels / mentions for the send_to_slack action. */
export const SLACK_MENTION_ROLES = ['none', 'oncall', 'mc', 'channel', 'here'] as const
export type SlackMentionRole = (typeof SLACK_MENTION_ROLES)[number]

export const SLACK_MENTION_ROLE_LABELS: Record<SlackMentionRole, string> = {
  none: 'No mention',
  oncall: '@oncall',
  mc: '@mc',
  channel: '@channel',
  here: '@here',
}

/** Sub-flow context-passing modes. */
export const SUB_FLOW_CONTEXT_MODES = ['inherit_all', 'couple_only', 'isolated'] as const
export type SubFlowContextMode = (typeof SUB_FLOW_CONTEXT_MODES)[number]

export const SUB_FLOW_CONTEXT_MODE_LABELS: Record<SubFlowContextMode, string> = {
  inherit_all: 'Pass all run variables through',
  couple_only: 'Pass the couple context only',
  isolated: 'Start with a clean context',
}

/** Generic merge modes for update_custom_fields. */
export const FIELD_MERGE_MODES = ['set', 'append', 'increment', 'only_if_unset'] as const
export type FieldMergeMode = (typeof FIELD_MERGE_MODES)[number]

export const FIELD_MERGE_MODE_LABELS: Record<FieldMergeMode, string> = {
  set: 'Set (overwrite)',
  append: 'Append (string / array)',
  increment: 'Increment (number)',
  only_if_unset: 'Only set if currently unset',
}

/** Note categories for add_note. */
export const NOTE_CATEGORIES = ['general', 'admin', 'followup', 'risk', 'private'] as const
export type NoteCategory = (typeof NOTE_CATEGORIES)[number]

export const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  general: 'General',
  admin: 'Admin',
  followup: 'Follow-up',
  risk: 'Risk / watchout',
  private: 'Private (never visible to couple)',
}

/** Pause categories for pause_couple_automations. */
export const PAUSE_CATEGORIES = ['general', 'cancellation', 'on_hold', 'postponed'] as const
export type PauseCategory = (typeof PAUSE_CATEGORIES)[number]

export const PAUSE_CATEGORY_LABELS: Record<PauseCategory, string> = {
  general: 'General pause',
  cancellation: 'Cancellation',
  on_hold: 'On hold',
  postponed: 'Wedding postponed',
}

/** Run-sheet PDF format variants. */
export const RUN_SHEET_FORMATS = ['full', 'vendor_only', 'mc_only', 'couple_only'] as const
export type RunSheetFormat = (typeof RUN_SHEET_FORMATS)[number]

export const RUN_SHEET_FORMAT_LABELS: Record<RunSheetFormat, string> = {
  full: 'Full run sheet',
  vendor_only: 'Vendor-only (hides MC notes)',
  mc_only: 'MC-only (private)',
  couple_only: 'Couple-only',
}

/** Timeline-item cue type (music / mic / lighting / none). */
export const TIMELINE_CUE_TYPES = ['none', 'music', 'mic', 'lighting', 'video', 'av'] as const
export type TimelineCueType = (typeof TIMELINE_CUE_TYPES)[number]

export const TIMELINE_CUE_TYPE_LABELS: Record<TimelineCueType, string> = {
  none: 'No cue',
  music: 'Music',
  mic: 'Microphone',
  lighting: 'Lighting',
  video: 'Video',
  av: 'AV / other',
}

/** Timeline-item category (ceremony / reception / prep / formalities). */
export const TIMELINE_CATEGORIES = [
  'prep',
  'ceremony',
  'formalities',
  'reception',
  'send_off',
  'other',
] as const
export type TimelineCategory = (typeof TIMELINE_CATEGORIES)[number]

export const TIMELINE_CATEGORY_LABELS: Record<TimelineCategory, string> = {
  prep: 'Prep / arrival',
  ceremony: 'Ceremony',
  formalities: 'Formalities',
  reception: 'Reception',
  send_off: 'Send-off',
  other: 'Other',
}

/** Signer-required slug for contracts. */
export const SIGNER_REQUIREMENTS = ['primary', 'spouse', 'both'] as const
export type SignerRequirement = (typeof SIGNER_REQUIREMENTS)[number]

export const SIGNER_REQUIREMENT_LABELS: Record<SignerRequirement, string> = {
  primary: 'Primary only',
  spouse: 'Spouse only',
  both: 'Both partners',
}

/** Calendar-event categories used by create_calendar_event. */
export const CALENDAR_EVENT_CATEGORIES = [
  'consultation',
  'rehearsal',
  'ceremony',
  'followup',
  'travel',
  'admin',
  'other',
] as const
export type CalendarEventCategory = (typeof CALENDAR_EVENT_CATEGORIES)[number]

export const CALENDAR_EVENT_CATEGORY_LABELS: Record<CalendarEventCategory, string> = {
  consultation: 'Consultation',
  rehearsal: 'Rehearsal',
  ceremony: 'Ceremony',
  followup: 'Follow-up',
  travel: 'Travel',
  admin: 'Admin / paperwork',
  other: 'Other',
}

/** Approval channels for the approval flow-control action. */
export const APPROVAL_CHANNELS = ['email', 'slack', 'in_app'] as const
export type ApprovalChannel = (typeof APPROVAL_CHANNELS)[number]

export const APPROVAL_CHANNEL_LABELS: Record<ApprovalChannel, string> = {
  email: 'Email magic link',
  slack: 'Slack message',
  in_app: 'In-app notification',
}

/** What to do when an approval window expires. */
export const APPROVAL_EXPIRY_BEHAVIOURS = ['cancel', 'proceed', 'pause'] as const
export type ApprovalExpiryBehaviour = (typeof APPROVAL_EXPIRY_BEHAVIOURS)[number]

export const APPROVAL_EXPIRY_BEHAVIOUR_LABELS: Record<ApprovalExpiryBehaviour, string> = {
  cancel: 'Cancel the run',
  proceed: 'Proceed as if approved',
  pause: 'Pause and notify the MC',
}
