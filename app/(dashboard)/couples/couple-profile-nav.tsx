/**
 * Tab navigation for the Couple Profile overlay (modal).
 *
 * Two renderings driven by the same `navItems` array:
 * - Mobile (≤ sm): a horizontal scrollable pill row pinned under
 *   the header.
 * - Desktop: a vertical sidebar nav on the left of the body.
 *
 * Stateless — the parent owns `activeSection` + the gated nav-item
 * list (e.g. "Contracts" is hidden when `hasContractsAccess` is
 * false). This component just renders the chrome.
 *
 * @module app/(dashboard)/couples/couple-profile-nav
 */
'use client';

import type { CoupleProfileSection, CoupleProfileNavItem } from './couple-profile-types';

export interface CoupleProfileNavProps {
  navItems: CoupleProfileNavItem[];
  activeSection: CoupleProfileSection;
  onSectionChange: (section: CoupleProfileSection) => void;
}

export function CoupleProfileNav({
  navItems,
  activeSection,
  onSectionChange,
}: CoupleProfileNavProps) {
  return (
    <>
      {/* Mobile: horizontal scrollable tab bar */}
      <div className="sm:hidden shrink-0 border-b border-gray-200 overflow-x-auto">
        <div className="flex px-2 py-2 gap-1 min-w-max">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => onSectionChange(item.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs whitespace-nowrap transition cursor-pointer ${
                activeSection === item.key
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
            onClick={() => onSectionChange(item.key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition cursor-pointer ${
              activeSection === item.key
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
