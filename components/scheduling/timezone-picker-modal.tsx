/**
 * Searchable IANA timezone picker.
 *
 * @module components/scheduling/timezone-picker-modal
 */
'use client';

import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { buildZoneOptions } from '@/lib/scheduling/timezone-options';

/**
 * Props for the timezone picker modal.
 */
export interface TimezonePickerModalProps {
  isOpen: boolean;
  /** Currently selected IANA timezone. */
  value: string;
  /** Called with the chosen zone; the modal closes itself first. */
  onSelect: (timezone: string) => void;
  onClose: () => void;
}

/**
 * Full-list timezone picker with a search box.
 *
 * A `Select` over 400-odd zones is unusable, so this is a modal: type a
 * city or a region, pick a row. The offset is shown because people pick by
 * "the zone I am in", and two zones with similar names often differ by an
 * hour.
 *
 * Shared by the MC's availability settings and the public booking page, so
 * both offer the same list and the same search.
 */
export function TimezonePickerModal({
  isOpen,
  value,
  onSelect,
  onClose,
}: TimezonePickerModalProps) {
  const [query, setQuery] = useState('');
  const zones = useMemo(() => buildZoneOptions(), []);

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? zones.filter((zone) => zone.search.includes(needle))
    : zones;

  const choose = (timezone: string) => {
    onSelect(timezone);
    setQuery('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select timezone"
      size="md"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          // Enter picks the top match, so a search-and-confirm never
          // needs the mouse.
          const first = matches[0];
          if (first) choose(first.id);
        }}
      >
        {/* No autoFocus: the modal opens on the list of zones, with the
            current one already ticked, and grabbing the caret straight away
            made it look like the field had to be used before anything else
            would happen. Typing still filters once the field is clicked. */}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a city or region"
          aria-label="Search timezones"
        />
      </form>

      {/* A fixed height, not max-height: the modal would otherwise shrink and
          grow under the search box as matches come and go. Sized against the
          viewport so the list always fits inside the modal's own 85vh cap and
          the search box never scrolls away. */}
      <div className="mt-3 h-[50vh] overflow-y-auto pr-2">
        {matches.length === 0 ? (
          <p className="py-6 text-body text-text-muted">
            No timezone matches “{query}”.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {matches.map((zone) => {
              const selected = zone.id === value;
              return (
                <li key={zone.id}>
                  <button
                    type="button"
                    onClick={() => choose(zone.id)}
                    className={`flex w-full items-center justify-between gap-3 px-2.5 py-2 text-left transition-colors hover:bg-surface-emphasis ${
                      selected ? 'bg-surface-muted' : ''
                    }`}
                  >
                    <span className="truncate text-body text-text">{zone.label}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-body text-text-muted tabular-nums">
                        {zone.offset}
                      </span>
                      {/* Always rendered, transparent when unselected, so the
                          offset column does not jump between rows. */}
                      <Check
                        strokeWidth={1.5}
                        className={`w-4 h-4 ${selected ? 'text-text' : 'text-transparent'}`}
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
