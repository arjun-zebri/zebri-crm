'use client';

import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';

import { DISABLED } from './control-styles';

/**
 * v2 rail tab: one tab of an editor's tool rail, its icon above a short
 * name, as Canva's left rail has them (Design, Elements, Text, Brand,
 * Uploads). The open tab takes the `pressed` fill at rest and is announced
 * as pressed; pressing it again closes its panel. Names are one word:
 * the rail is 72px wide.
 *
 * @example
 * <RailTab icon={Shapes} label="Elements" active={tab === 'elements'} onClick={() => toggle('elements')} />
 *
 * @module components/ui-v2/rail-tab
 */

export interface RailTabProps {
  icon: ZebriIcon;
  label: string;
  /** Its panel is open. */
  active: boolean;
  onClick: () => void;
  /** Greys the tab out; it cannot be opened. */
  disabled?: boolean | undefined;
}

/** v2 rail tab. See {@link RailTabProps}. */
export function RailTab({ icon: Icon, label, active, onClick, disabled = false }: RailTabProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex w-16 flex-col items-center gap-1 rounded-panel py-2 type-body transition-colors duration-150 focus-mark ${DISABLED} motion-reduce:transition-none ${
        active ? 'bg-pressed text-zebra-950' : 'text-zebra-600 hover:bg-hover hover:text-zebra-950'
      }`}
    >
      <Icon aria-hidden="true" strokeWidth={1.5} className="size-5" />
      {label}
    </button>
  );
}
