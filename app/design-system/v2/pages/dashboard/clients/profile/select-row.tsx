import type { ReactNode } from 'react';

/**
 * A row in a list whose selected item shows in the panel beside it
 * (Activity, Documents). The selected row sits on a grey fill. The panel
 * is only beside the list from `lg`; below that, the selected row's
 * `detail` opens under the row itself, so choosing one still shows
 * something where the finger is.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/select-row
 */

export interface SelectRowProps {
  selected: boolean;
  onSelect: () => void;
  /** What the panel shows for this row, repeated under it on small screens. */
  detail: ReactNode;
  children: ReactNode;
}

/** A selectable row. Put it in a `<ul className="-mx-3">` so its fill overhangs the text edge. */
export function SelectRow({ selected, onSelect, detail, children }: SelectRowProps) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={`flex w-full items-start gap-4 rounded-button px-3 py-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 motion-reduce:transition-none ${
          selected ? 'bg-zebra-950/5' : 'hover:bg-zebra-950/[0.03]'
        }`}
      >
        {children}
      </button>
      {selected ? <div className="px-3 pb-4 pt-3 lg:hidden">{detail}</div> : null}
    </li>
  );
}
