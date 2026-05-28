/**
 * Shared types for the Couple Profile overlay (modal) decomposition.
 *
 * The 9-tab nav + header + body files import these in a circle-free
 * way (component files → this file → no cycles).
 *
 * @module app/(dashboard)/couples/couple-profile-types
 */
import type {
  Activity,
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
  | 'pulse'
  | 'tasks'
  | 'contacts'
  | 'timeline'
  | 'songs'
  | 'files'
  | 'payments'
  | 'contracts';

export interface CoupleProfileNavItem {
  key: CoupleProfileSection;
  label: string;
  icon: React.ReactNode;
}

// Re-export the lucide types so consumers don't have to repeat the
// import block (a small ergonomics win — the icons themselves stay
// declared in the nav-items factory, not here).
export type LucideIcon =
  | typeof Activity
  | typeof CheckSquare
  | typeof Clock
  | typeof FileSignature
  | typeof FileText
  | typeof LayoutDashboard
  | typeof Music
  | typeof Paperclip
  | typeof Receipt
  | typeof Users;
