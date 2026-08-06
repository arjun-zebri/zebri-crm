'use client';

import { Globe, Phone } from 'lucide-react';
import { useRef, useState } from 'react';

/** A venue plus the place metadata the maps autocomplete fills in. */
export interface VenueDetails {
  venue: string;
  venue_phone: string | null;
  venue_website: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
}

/** A blank venue value (no place selected). */
export const EMPTY_VENUE: VenueDetails = {
  venue: '',
  venue_phone: null,
  venue_website: null,
  venue_lat: null,
  venue_lng: null,
};

interface PlaceSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

/** Shape of the `/api/places/autocomplete` prediction entries. */
interface PlacePrediction {
  placePrediction: {
    placeId: string;
    structuredFormat: {
      mainText: { text: string };
      secondaryText?: { text: string };
    };
  };
}

interface VenueAutocompleteProps {
  value: VenueDetails;
  onChange: (value: VenueDetails) => void;
  placeholder?: string;
  /** Class for the text input so callers can match their form vocabulary. */
  inputClassName?: string;
  /** Show the picked place's phone/website below the input. Off in
   *  compact forms (e.g. the Add Couple modal) so a selection doesn't
   *  grow the field and shove the rest of the form down. Defaults true. */
  showDetails?: boolean;
}

/**
 * Venue text field backed by Google Places autocomplete. Typing fetches
 * suggestions (debounced); picking one fills the venue name plus its
 * phone / website / lat / lng. Editing by hand clears the place metadata
 * so stale details never linger. Shared by the Event modal and the Add
 * Couple modal so both capture venues the same way.
 *
 * @module app/(dashboard)/couples/venue-autocomplete
 */
export function VenueAutocomplete({
  value,
  onChange,
  placeholder = 'Search a venue or address',
  inputClassName,
  showDetails = true,
}: VenueAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(text: string) {
    onChange({ ...EMPTY_VENUE, venue: text });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/places/autocomplete?input=${encodeURIComponent(text)}`,
        );
        const data = (await res.json()) as { suggestions?: PlacePrediction[] };
        const next: PlaceSuggestion[] = (data.suggestions ?? []).map((s) => ({
          placeId: s.placePrediction.placeId,
          mainText: s.placePrediction.structuredFormat.mainText.text,
          secondaryText: s.placePrediction.structuredFormat.secondaryText?.text ?? '',
        }));
        setSuggestions(next);
        setOpen(next.length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    }, 300);
  }

  async function handleSelect(suggestion: PlaceSuggestion) {
    setSuggestions([]);
    setOpen(false);
    let details = {
      venue_phone: null as string | null,
      venue_website: null as string | null,
      venue_lat: null as number | null,
      venue_lng: null as number | null,
    };
    try {
      const res = await fetch(
        `/api/places/details?place_id=${suggestion.placeId}`,
      );
      const data = (await res.json()) as {
        nationalPhoneNumber?: string;
        websiteUri?: string;
        location?: { latitude?: number; longitude?: number };
      };
      details = {
        venue_phone: data.nationalPhoneNumber ?? null,
        venue_website: data.websiteUri ?? null,
        venue_lat: data.location?.latitude ?? null,
        venue_lng: data.location?.longitude ?? null,
      };
    } catch {
      // Venue name is set; the metadata is just a bonus.
    }
    onChange({ venue: suggestion.mainText, ...details });
  }

  return (
    <div>
      <div className="relative">
        <input
          type="text"
          value={value.venue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className={inputClassName}
          autoComplete="off"
        />
        {open && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-48 overflow-y-auto rounded-control border border-border bg-surface shadow-lg">
            {suggestions.map((s) => (
              <button
                key={s.placeId}
                type="button"
                onMouseDown={() => handleSelect(s)}
                className="w-full cursor-pointer px-3 py-2 text-left transition hover:bg-gray-50"
              >
                <p className="text-body font-medium text-text">{s.mainText}</p>
                {s.secondaryText && (
                  <p className="text-caption text-text-muted">{s.secondaryText}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      {showDetails && (value.venue_phone || value.venue_website) && (
        <div className="mt-2 flex flex-col gap-1.5">
          {value.venue_phone && (
            <div className="flex items-center gap-2">
              <Phone size={11} strokeWidth={1.5} className="shrink-0 text-text-subtle" />
              <span className="text-caption text-gray-600">{value.venue_phone}</span>
            </div>
          )}
          {value.venue_website && (
            <div className="flex min-w-0 items-center gap-2">
              <Globe size={11} strokeWidth={1.5} className="shrink-0 text-text-subtle" />
              <a
                href={value.venue_website}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-caption text-gray-600 underline hover:text-text"
              >
                {value.venue_website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
