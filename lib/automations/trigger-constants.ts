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

/** Common AU lead-source slugs for the `new_enquiry` filter. */
export const LEAD_SOURCES = [
  'website',
  'instagram',
  'facebook',
  'tiktok',
  'google',
  'easy_weddings',
  'wedding_wire',
  'abia',
  'heart_wedding',
  'referral',
  'word_of_mouth',
  'past_couple',
  'other',
] as const
export type LeadSource = (typeof LEAD_SOURCES)[number]

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website: 'Website form',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  google: 'Google search',
  easy_weddings: 'Easy Weddings',
  wedding_wire: 'WeddingWire',
  abia: 'ABIA',
  heart_wedding: 'Heart Wedding directory',
  referral: 'Referral (vendor / planner)',
  word_of_mouth: 'Word of mouth',
  past_couple: 'Past couple referral',
  other: 'Other',
}

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
export const COMPARISON_OPS = ['gte', 'gt', 'lte', 'lt', 'eq'] as const
export type ComparisonOp = (typeof COMPARISON_OPS)[number]

export const COMPARISON_OP_LABELS: Record<ComparisonOp, string> = {
  gte: 'at least',
  gt: 'more than',
  lte: 'at most',
  lt: 'less than',
  eq: 'exactly',
}

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
