/**
 * All-day event band for the day-view hour grid.
 *
 * Wedding events (which have a date but no time component) are pinned above
 * the grid in a dedicated band. Clicking an event opens the couple profile
 * exactly as the current day view does.
 *
 * @module app/(dashboard)/calendar/_components/grid-all-day-band
 */
import { MapPin } from 'lucide-react';

/**
 * Represents a wedding event with couple metadata.
 */
export interface AllDayEvent {
  id: string;
  title?: string;
  venue?: string;
  couple?: {
    id: string;
    name: string;
  };
}

/**
 * Props for GridAllDayBand.
 */
export interface GridAllDayBandProps {
  /** All-day events for this date. */
  events: AllDayEvent[];
  /** Callback when an event is clicked. */
  onSelectCouple: (coupleId: string) => void;
}

/**
 * All-day event band above the hour grid.
 *
 * Renders wedding events with couple name, venue, and a clickable card
 * that opens the couple profile.
 *
 * @param props - GridAllDayBandProps
 * @returns JSX element
 */
export function GridAllDayBand({
  events,
  onSelectCouple,
}: GridAllDayBandProps) {
  if (events.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-border pb-3 mb-3 space-y-2">
      {events.map((event) => (
        <button
          key={event.id}
          onClick={() => event.couple && onSelectCouple(event.couple.id)}
          className="w-full text-left bg-surface border border-border rounded-control p-3 transition hover:shadow-md cursor-pointer"
        >
          <div className="font-medium text-text text-body">
            {event.title || event.couple?.name || 'Wedding Event'}
          </div>
          {event.venue && (
            <div className="flex items-center gap-1.5 mt-1 text-body text-text-muted">
              <MapPin size={14} strokeWidth={1.5} />
              {event.venue}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
