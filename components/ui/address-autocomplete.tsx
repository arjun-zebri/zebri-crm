'use client'

import { useEffect, useRef, useState } from 'react'

import { Input } from '@/components/ui/input'

/** A resolved address: free text plus optional coordinates. */
export interface AddressValue {
  text: string
  lat: number | null
  lng: number | null
}

interface AddressSuggestion {
  placeId: string
  text: string
}

/** Props for {@link AddressAutocomplete}. */
export interface AddressAutocompleteProps {
  /** Current address text (controlled). */
  value: string
  /** Fires on every keystroke. Coordinates are always null here. */
  onChange: (next: AddressValue) => void
  /** Fires once a suggestion is picked and its coordinates resolve. */
  onSelect?: (next: AddressValue) => void
  label?: string
  help?: string
  placeholder?: string
}

/**
 * Google Places address field with debounced suggestions.
 *
 * Typing clears any previously resolved coordinates, because the text no
 * longer describes the place those coordinates point at. Coordinates come
 * back only from an explicit suggestion pick.
 */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  label = 'Home address',
  help,
  placeholder = 'Start typing your address...',
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [internalValue, setInternalValue] = useState(value)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync external value prop changes to internal state
  useEffect(() => {
    setInternalValue(value)
  }, [value])

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  const handleChange = (next: string) => {
    setInternalValue(next)
    onChange({ text: next, lat: null, lng: null })
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (next.trim().length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/places/address-autocomplete?input=${encodeURIComponent(next)}`,
        )
        const data = await res.json()
        const parsed: AddressSuggestion[] = (data.suggestions ?? [])
          .map((s: { placePrediction: { placeId: string; text: { text: string } } }) => ({
            placeId: s.placePrediction?.placeId,
            text: s.placePrediction?.text?.text,
          }))
          .filter((s: AddressSuggestion) => s.placeId && s.text)
        setSuggestions(parsed)
        setOpen(parsed.length > 0)
      } catch {
        setSuggestions([])
      }
    }, 300)
  }

  const handleSelect = async (suggestion: AddressSuggestion) => {
    setOpen(false)
    setSuggestions([])
    let lat: number | null = null
    let lng: number | null = null
    try {
      const res = await fetch(`/api/places/details?place_id=${suggestion.placeId}`)
      const data = await res.json()
      if (data.location) {
        lat = data.location.latitude
        lng = data.location.longitude
      }
    } catch {
      // Coordinates are optional. The address text is still worth keeping.
    }
    onSelect?.({ text: suggestion.text, lat, lng })
  }

  return (
    <div className="relative">
      <Input
        label={label}
        help={help}
        value={internalValue}
        onChange={(e) => handleChange(e.target.value)}
        // Delay the close so a mousedown on a suggestion still registers.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-card border border-border rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                onMouseDown={() => handleSelect(s)}
                className="w-full text-left px-3 py-2 text-sm text-text hover:bg-surface-muted cursor-pointer"
              >
                {s.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
