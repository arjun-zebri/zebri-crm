'use client';

/**
 * Underline tabs: a row of text tabs with a 2px underline under the
 * active one. Navigation-style (each tab is a button that reports its
 * id; the caller decides whether that's a route change or local state).
 *
 * Extracted from the hand-rolled bar Admin had inline, so Admin's
 * sections and the Outreach views share one implementation.
 *
 * @module components/ui/underline-tabs
 */

/** One tab. */
export interface UnderlineTab<T extends string> {
  id: T;
  label: string;
}

/** Underline tabs; horizontally scrollable on narrow screens. */
export function UnderlineTabs<T extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
}: {
  tabs: UnderlineTab<T>[];
  active: T;
  onChange: (id: T) => void;
  ariaLabel: string;
}) {
  return (
    <nav aria-label={ariaLabel} className="relative overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] border-b border-border">
      <div className="flex gap-6 mb-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            aria-current={active === tab.id ? 'page' : undefined}
            className={`pb-3 text-body whitespace-nowrap transition-colors relative cursor-pointer ${
              active === tab.id ? 'text-text font-medium' : 'text-text-muted hover:text-text'
            }`}
          >
            {tab.label}
            {active === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-text" />}
          </button>
        ))}
      </div>
    </nav>
  );
}
