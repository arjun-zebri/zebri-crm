/**
 * Shared types for the Couple Profile overlay (modal) decomposition.
 *
 * The 9-tab nav + header + body files import these in a circle-free
 * way (component files → this file → no cycles).
 *
 * @module app/(dashboard)/couples/couple-profile-types
 */
import type {
  Clock,
  FileSignature,
  FileText,
  LayoutDashboard,
  ListChecks,
  Music,
  Paperclip,
  Receipt,
  ScrollText,
  Users,
} from 'lucide-react';

export type CoupleProfileSection =
  | 'overview'
  | 'workflow'
  | 'time'
  | 'contacts'
  | 'timeline'
  | 'songs'
  | 'files'
  | 'vows'
  | 'scripts'
  | 'payments'
  | 'contracts'
  | 'questionnaires'
  | 'emails';

/**
 * Canonical list of every tab key, in the default order. Single source of
 * truth shared by the nav factory, the tab-settings Zod schema (server
 * action), and the client derive logic — so a new tab only has to be added
 * here (plus its `NAV_ITEMS` entry) and everything else stays in sync.
 */
export const SECTION_KEYS: readonly CoupleProfileSection[] = [
  'overview',
  'workflow',
  'time',
  'contacts',
  'timeline',
  'songs',
  'files',
  'vows',
  'scripts',
  'payments',
  'contracts',
  'questionnaires',
  'emails',
] as const;

/**
 * Per-user, global-across-couples layout for the couple profile tab nav.
 * Persisted as `user_public_settings.couple_profile_tabs_config`.
 *
 * - `hidden_tabs`: tab keys the MC has hidden. Never contains `'overview'`
 *   (it is the guaranteed-visible fallback).
 * - `tab_order`: ordered tab keys. An empty array means "use the code
 *   default order" (`SECTION_KEYS` / `NAV_ITEMS`).
 */
export interface CoupleProfileTabsConfig {
  hidden_tabs: CoupleProfileSection[];
  tab_order: CoupleProfileSection[];
}

/** Config used before the MC has configured anything (all tabs, code order). */
export const DEFAULT_TABS_CONFIG: CoupleProfileTabsConfig = {
  hidden_tabs: [],
  tab_order: [],
};

export interface CoupleProfileNavItem {
  key: CoupleProfileSection;
  label: string;
  icon: React.ReactNode;
}

// Re-export the lucide types so consumers don't have to repeat the
// import block (a small ergonomics win — the icons themselves stay
// declared in the nav-items factory, not here).
export type LucideIcon =
  | typeof Clock
  | typeof FileSignature
  | typeof FileText
  | typeof LayoutDashboard
  | typeof ListChecks
  | typeof Music
  | typeof Paperclip
  | typeof Receipt
  | typeof ScrollText
  | typeof Users;

/**
 * Tab keys that existed before Workflows replaced Tasks and Automations,
 * mapped to the tab that took their place.
 *
 * Stored layouts are per-user JSON, so an MC who reordered or hid either
 * legacy tab still has those strings saved. Without this map the keys would
 * simply be dropped on read and `workflow` would reappend itself at the end
 * of the nav, silently undoing their ordering.
 */
export const LEGACY_SECTION_KEYS: Readonly<Record<string, CoupleProfileSection>> =
  {
    tasks: 'workflow',
    automations: 'workflow',
  };
