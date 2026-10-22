import type { ComponentType, ReactNode } from 'react';

/**
 * A setting as a record row, the client Overview's layout: its icon, its
 * name in grey, then its value, usually a `ValuePicker` ("7 days ⌄"), and
 * any words that finish the sentence ("before the event"). Rows sit in a
 * {@link SETTING_ROWS} grid so the names and values line up.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/setting-row
 */

export interface SettingRowProps {
  /** The setting's name, shown in the grey column ("Deposit"). */
  label: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
  /** The value's control. */
  children: ReactNode;
  /** Words that finish the phrase ("before the event"). */
  after?: string | undefined;
}

/** The grid every setting row shares: icon, name, value. */
export const SETTING_ROWS = 'grid grid-cols-[1rem_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2';

/** One named row. See {@link SettingRowProps}. */
export function SettingRow({ label, icon: Icon, children, after }: SettingRowProps) {
  return (
    <div className="contents">
      <Icon aria-hidden="true" className="size-4 text-zebra-400" />
      <span className="type-body text-zebra-500">{label}</span>
      {/* One line: a value and the words finishing it never wrap apart. */}
      <div className="flex min-h-9 min-w-0 items-center gap-x-2 whitespace-nowrap type-body text-zebra-950">
        {children}
        {after ? <span className="text-zebra-500">{after}</span> : null}
      </div>
    </div>
  );
}
