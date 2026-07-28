/**
 * Shared types for the Couple Profile overlay (modal) decomposition.
 *
 * The 9-tab nav + header + body files import these in a circle-free
 * way (component files → this file → no cycles).
 *
 * @module app/(dashboard)/couples/couple-profile-types
 */
import type {
  CheckSquare,
  Clock,
  FileSignature,
  FileText,
  LayoutDashboard,
  Music,
  Paperclip,
  Receipt,
  Users,
} from 'lucide-react';

export type CoupleProfileSection =
  | 'overview'
  | 'tasks'
  | 'contacts'
  | 'timeline'
  | 'songs'
  | 'files'
  | 'vows'
  | 'payments'
  | 'contracts'
  | 'questionnaires'
  | 'automations'
  | 'emails';

/**
 * Canonical list of every tab key, in the default order. Single source of
 * truth shared by the nav factory, the tab-settings Zod schema (server
 * action), and the client derive logic — so a new tab only has to be added
 * here (plus its `NAV_ITEMS` entry) and everything else stays in sync.
 */
export const SECTION_KEYS: readonly CoupleProfileSection[] = [
  'overview',
  'tasks',
  'contacts',
  'timeline',
  'songs',
  'files',
  'vows',
  'payments',
  'contracts',
  'questionnaires',
  'automations',
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
  | typeof CheckSquare
  | typeof Clock
  | typeof FileSignature
  | typeof FileText
  | typeof LayoutDashboard
  | typeof Music
  | typeof Paperclip
  | typeof Receipt
  | typeof Users;
