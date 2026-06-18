/**
 * Tab navigation for the Settings overlay modal.
 *
 * Mirrors `couple-profile-nav`: a vertical sidebar on desktop and a
 * horizontal scrollable pill row on mobile, driven by one nav-item
 * array. Stateless — the parent owns `activeTab`.
 *
 * @module app/(dashboard)/settings/settings-nav
 */
'use client';

import {
  CreditCard,
  FileText,
  Landmark,
  Lock,
  Shield,
  User,
} from 'lucide-react';

export type SettingsTabId =
  | 'personal-info'
  | 'account'
  | 'billing'
  | 'payments'
  | 'privacy'
  | 'terms';

export interface SettingsNavItem {
  key: SettingsTabId;
  label: string;
  icon: React.ReactNode;
}

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  { key: 'personal-info', label: 'Personal Info', icon: <User size={18} strokeWidth={1.5} /> },
  { key: 'account', label: 'Account', icon: <Lock size={18} strokeWidth={1.5} /> },
  { key: 'billing', label: 'Plans & Billing', icon: <CreditCard size={18} strokeWidth={1.5} /> },
  { key: 'payments', label: 'Receive Payments', icon: <Landmark size={18} strokeWidth={1.5} /> },
  { key: 'privacy', label: 'Privacy', icon: <Shield size={18} strokeWidth={1.5} /> },
  { key: 'terms', label: 'Terms', icon: <FileText size={18} strokeWidth={1.5} /> },
];

export interface SettingsNavProps {
  navItems: SettingsNavItem[];
  activeTab: SettingsTabId;
  onTabChange: (id: SettingsTabId) => void;
}

export function SettingsNav({ navItems, activeTab, onTabChange }: SettingsNavProps) {
  return (
    <>
      {/* Mobile: horizontal scrollable tab bar */}
      <div className="sm:hidden shrink-0 border-b border-gray-200 overflow-x-auto">
        <div className="flex px-2 py-2 gap-1 min-w-max">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => onTabChange(item.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs whitespace-nowrap transition cursor-pointer ${
                activeTab === item.key
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-500'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Desktop: vertical sidebar */}
      <nav className="hidden sm:block w-[200px] shrink-0 border-r border-gray-200 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onTabChange(item.key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition cursor-pointer ${
              activeTab === item.key
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
