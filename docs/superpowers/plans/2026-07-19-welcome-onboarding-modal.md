# Welcome Onboarding Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an eight-step modal, shown once on first login, that fills the profile gaps signup left and shows a new MC the core loop of Zebri through four animated previews.

**Architecture:** A client-side wizard mounted from the dashboard layout, gated on `user_metadata.welcome_onboarded_at`. Steps 2 and 3 write profile fields through `supabase.auth.updateUser`. Steps 4 to 7 are hand-built animated mocks driven by a shared beat-timer hook inside a shared miniature-app chassis. No new tables, no migration, no API routes.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4 semantic tokens, Supabase JS browser client, Vitest 3 + React Testing Library, Playwright.

**Design spec:** `docs/superpowers/specs/2026-07-19-welcome-onboarding-modal-design.md`

## Global Constraints

- Every file stays under ~150 lines. Split when larger.
- TSDoc on every exported function, type and component. Why-comments on non-obvious logic.
- Tailwind semantic tokens only (`bg-surface`, `text-text-muted`, `border-border`). No arbitrary-value colours, no inline `style={{}}`, no CSS modules.
- Use `components/ui/` primitives. No raw `<button>`, `<select>`, `<input>` in new files.
- Lucide icons always `strokeWidth={1.5}`. Buttons `rounded-xl`, never `rounded-full`. Interactive elements get `cursor-pointer`.
- No em dashes in any copy, comment or prose.
- `npm run typecheck` must stay at 0 errors. New code must be clean under `npm run typecheck:strict`.
- Must work on desktop, Pixel 5 and iPhone 12 using Tailwind responsive prefixes only.
- Imports use `@/` absolute paths, never `../../`.
- The metadata keys are fixed and must match Settings exactly: `display_name`, `business_name`, `phone`, `website`, `instagram_url`, `facebook_url`, `mc_signature_name`, `address_text`, `address_lat`, `address_lng`, plus the new `welcome_onboarded_at`.

---

## File Structure

**Created:**

```
components/ui/address-autocomplete.tsx     shared Places autocomplete, extracted from Settings
app/(dashboard)/onboarding/
  welcome-gate.tsx        reads the flag, decides whether to mount the modal
  welcome-modal.tsx       Modal shell + dismissal
  welcome-wizard.tsx      step state machine, save on step 3
  wizard-chrome.tsx       footer nav + progress bar
  use-reduced-motion.ts   prefers-reduced-motion hook
  steps/
    step-welcome.tsx      1
    step-details.tsx      2
    step-links.tsx        3
    step-preview.tsx      4 to 7 host: heading, copy, script slot
    step-founder.tsx      8
  previews/
    use-preview-script.ts shared beat timer
    preview-frame.tsx     miniature Zebri window chassis
    script-couple.tsx     4
    script-template.tsx   5
    script-send.tsx       6
    script-automation.tsx 7
tests/unit/onboarding/*.test.tsx
tests/e2e/welcome-onboarding.spec.ts
```

**Modified:**

- `app/(dashboard)/settings/personal-info-section.tsx` (address block replaced by the shared component)
- `app/(dashboard)/layout.tsx` (mounts `WelcomeGate`)
- `.claude/docs/page-specs.md`, `.claude/docs/component-library.md`, `.claude/docs/testing.md`

**Responsibility boundaries.** `welcome-gate` owns "should this appear at all". `welcome-modal` owns the shell and dismissal. `welcome-wizard` owns step state and the save. Step components own their own content and nothing else. Preview scripts own their own animation and expose only `{ active, reducedMotion }`, so any script can be rewritten without touching the wizard.

---

### Task 1: Extract the address autocomplete into a shared component

The Places autocomplete currently lives inline in `personal-info-section.tsx` (lines 25 to 28, 58 to 63, 109 to 151, 424 to 450). Onboarding needs the same behaviour, so it moves to a shared component first and Settings becomes its first consumer.

**Files:**
- Create: `components/ui/address-autocomplete.tsx`
- Modify: `app/(dashboard)/settings/personal-info-section.tsx`
- Test: `tests/unit/ui/address-autocomplete.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  ```ts
  export interface AddressValue { text: string; lat: number | null; lng: number | null }
  export interface AddressAutocompleteProps {
    value: string
    onChange: (next: AddressValue) => void
    onSelect?: (next: AddressValue) => void
    label?: string
    help?: string
    placeholder?: string
  }
  export function AddressAutocomplete(props: AddressAutocompleteProps): JSX.Element
  ```
  `onChange` fires on every keystroke with `lat`/`lng` null. `onSelect` fires once a suggestion is chosen and its coordinates have resolved.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ui/address-autocomplete.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { AddressAutocomplete } from '@/components/ui/address-autocomplete'

function mockFetch() {
  return vi.fn(async (url: string) => {
    if (url.includes('address-autocomplete')) {
      return {
        json: async () => ({
          suggestions: [
            { placePrediction: { placeId: 'p1', text: { text: '12 Smith St, Fitzroy VIC' } } },
          ],
        }),
      } as Response
    }
    return {
      json: async () => ({ location: { latitude: -37.8, longitude: 144.9 } }),
    } as Response
  })
}

describe('AddressAutocomplete', () => {
  beforeEach(() => { vi.stubGlobal('fetch', mockFetch()) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('reports typed text with null coordinates', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<AddressAutocomplete value="" onChange={onChange} label="Home address" />)

    await user.type(screen.getByLabelText('Home address'), '12')

    expect(onChange).toHaveBeenLastCalledWith({ text: '12', lat: null, lng: null })
  })

  it('resolves coordinates when a suggestion is chosen', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <AddressAutocomplete value="12" onChange={vi.fn()} onSelect={onSelect} label="Home address" />,
    )

    await user.type(screen.getByLabelText('Home address'), '2 Smith')
    const option = await screen.findByText('12 Smith St, Fitzroy VIC')
    await user.click(option)

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith({
        text: '12 Smith St, Fitzroy VIC',
        lat: -37.8,
        lng: 144.9,
      })
    })
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --project unit tests/unit/ui/address-autocomplete.test.tsx`
Expected: FAIL, cannot resolve `@/components/ui/address-autocomplete`.

- [ ] **Step 3: Write the component**

Create `components/ui/address-autocomplete.tsx`:

```tsx
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  const handleChange = (next: string) => {
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
        value={value}
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
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run --project unit tests/unit/ui/address-autocomplete.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Refactor Settings to consume it**

In `app/(dashboard)/settings/personal-info-section.tsx`:

1. Delete the `AddressSuggestion` interface (lines 25 to 28).
2. Delete the `addressSuggestions`, `showAddressSuggestions` and `addressDebounceRef` state (lines 61 to 63).
3. Delete `handleAddressChange` and `handleAddressSelect` (lines 109 to 151).
4. Add the import:

```tsx
import { AddressAutocomplete, type AddressValue } from '@/components/ui/address-autocomplete'
```

5. Replace the address block (the `<div className="sm:col-span-2 relative">` at line 424 through its closing `</div>`) with:

```tsx
<div className="sm:col-span-2">
  <AddressAutocomplete
    value={addressText}
    help="Used to calculate drive time to each event."
    onChange={(next: AddressValue) => {
      setAddressText(next.text)
      setAddressLat(next.lat)
      setAddressLng(next.lng)
    }}
    onSelect={(next: AddressValue) => {
      setAddressText(next.text)
      setAddressLat(next.lat)
      setAddressLng(next.lng)
      // Persist after this render commits so autoSave reads the
      // freshly-set coordinates rather than a stale closure.
      setSaveSignal((n) => n + 1)
    }}
  />
</div>
```

The `savingRef` / `pendingRef` race handling at lines 162 to 169 stays as it is: picking a suggestion still blurs the input and still resolves coordinates a moment later.

- [ ] **Step 6: Verify Settings still works**

Run: `npm run typecheck`
Expected: 0 errors.

Then drive the real page. Start the app, open Settings, Personal info, type into Home address, pick a suggestion, and confirm the "Saved" hint appears and the value survives a reload. This is a refactor of a working feature, so the check is that nothing changed from the user's side.

- [ ] **Step 7: Commit**

```bash
git add components/ui/address-autocomplete.tsx tests/unit/ui/address-autocomplete.test.tsx "app/(dashboard)/settings/personal-info-section.tsx"
git commit -m "refactor(ui): extract AddressAutocomplete from settings"
```

---

### Task 2: Preview beat timer

Every preview animates as a sequence of beats. One hook owns the timing so four scripts do not each reinvent it, and so reduced motion has a single implementation.

**Files:**
- Create: `app/(dashboard)/onboarding/previews/use-preview-script.ts`
- Create: `app/(dashboard)/onboarding/use-reduced-motion.ts`
- Test: `tests/unit/onboarding/use-preview-script.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function usePreviewScript(opts: {
    beats: number
    active: boolean
    reducedMotion: boolean
    beatMs?: number
  }): number
  export function useReducedMotion(): boolean
  ```
  Returns the current beat index, 0-based. Starts at 0 when `active` becomes true, advances every `beatMs` (default 1200), and stops at `beats - 1`. When `reducedMotion` is true it returns `beats - 1` immediately. When `active` is false it returns 0, so navigating back and returning replays from the start.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/onboarding/use-preview-script.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { usePreviewScript } from '@/app/(dashboard)/onboarding/previews/use-preview-script'

describe('usePreviewScript', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('stays at beat 0 while inactive', () => {
    const { result } = renderHook(() =>
      usePreviewScript({ beats: 4, active: false, reducedMotion: false }),
    )
    act(() => { vi.advanceTimersByTime(5000) })
    expect(result.current).toBe(0)
  })

  it('advances one beat at a time while active', () => {
    const { result } = renderHook(() =>
      usePreviewScript({ beats: 4, active: true, reducedMotion: false, beatMs: 1000 }),
    )
    expect(result.current).toBe(0)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current).toBe(1)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(result.current).toBe(3)
  })

  it('stops at the final beat', () => {
    const { result } = renderHook(() =>
      usePreviewScript({ beats: 3, active: true, reducedMotion: false, beatMs: 1000 }),
    )
    act(() => { vi.advanceTimersByTime(10000) })
    expect(result.current).toBe(2)
  })

  it('jumps straight to the final beat under reduced motion', () => {
    const { result } = renderHook(() =>
      usePreviewScript({ beats: 5, active: true, reducedMotion: true }),
    )
    expect(result.current).toBe(4)
  })

  it('replays from the start when reactivated', () => {
    const { result, rerender } = renderHook(
      ({ active }) => usePreviewScript({ beats: 4, active, reducedMotion: false, beatMs: 1000 }),
      { initialProps: { active: true } },
    )
    act(() => { vi.advanceTimersByTime(2000) })
    expect(result.current).toBe(2)
    rerender({ active: false })
    expect(result.current).toBe(0)
    rerender({ active: true })
    expect(result.current).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --project unit tests/unit/onboarding/use-preview-script.test.ts`
Expected: FAIL, cannot resolve the module.

- [ ] **Step 3: Write the hooks**

Create `app/(dashboard)/onboarding/previews/use-preview-script.ts`:

```ts
'use client'

import { useEffect, useState } from 'react'

/** Options for {@link usePreviewScript}. */
export interface PreviewScriptOptions {
  /** Total number of beats in the sequence. */
  beats: number
  /** True when this preview's step is on screen. */
  active: boolean
  reducedMotion: boolean
  /** Milliseconds per beat. Default 1200. */
  beatMs?: number
}

/**
 * Drives a preview's animation as a monotonic beat counter.
 *
 * Beats advance while the step is active and then rest on the final frame.
 * There is no looping: a looping animation behind a Next button competes
 * with the button for attention.
 */
export function usePreviewScript({
  beats,
  active,
  reducedMotion,
  beatMs = 1200,
}: PreviewScriptOptions): number {
  const [beat, setBeat] = useState(0)

  useEffect(() => {
    if (!active) {
      setBeat(0)
      return
    }
    if (reducedMotion) {
      setBeat(beats - 1)
      return
    }
    setBeat(0)
    const id = setInterval(() => {
      setBeat((b) => (b >= beats - 1 ? b : b + 1))
    }, beatMs)
    return () => clearInterval(id)
  }, [active, reducedMotion, beats, beatMs])

  return beat
}
```

Create `app/(dashboard)/onboarding/use-reduced-motion.ts`:

```ts
'use client'

import { useEffect, useState } from 'react'

/**
 * True when the user has asked for reduced motion.
 *
 * Defaults to false so the animation runs in environments without
 * matchMedia (jsdom), which keeps the previews testable.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run --project unit tests/unit/onboarding/use-preview-script.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/onboarding/previews/use-preview-script.ts" "app/(dashboard)/onboarding/use-reduced-motion.ts" tests/unit/onboarding/use-preview-script.test.ts
git commit -m "feat(onboarding): preview beat timer and reduced-motion hook"
```

---

### Task 3: Wizard chrome

The footer and progress bar, built before the steps so the shell can be assembled and walked early.

**Files:**
- Create: `app/(dashboard)/onboarding/wizard-chrome.tsx`
- Test: `tests/unit/onboarding/wizard-chrome.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type WelcomeStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  export interface WizardChromeProps {
    step: WelcomeStep
    saving: boolean
    onBack: () => void
    onSkip: () => void
    onNext: () => void
    onFinish: () => void
  }
  export function WizardChrome(props: WizardChromeProps): JSX.Element
  ```
  Back is hidden on step 1. Skip appears on steps 2 and 3 only. The primary button reads Next on steps 1 to 7 and Finish on step 8.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/onboarding/wizard-chrome.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

import { WizardChrome, type WelcomeStep } from '@/app/(dashboard)/onboarding/wizard-chrome'

function setup(step: WelcomeStep) {
  const handlers = {
    onBack: vi.fn(), onSkip: vi.fn(), onNext: vi.fn(), onFinish: vi.fn(),
  }
  render(<WizardChrome step={step} saving={false} {...handlers} />)
  return handlers
}

describe('WizardChrome', () => {
  it('hides Back on the first step', () => {
    setup(1)
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
  })

  it('shows Skip only on the form steps', () => {
    const { unmount } = render(
      <WizardChrome step={2} saving={false} onBack={vi.fn()} onSkip={vi.fn()} onNext={vi.fn()} onFinish={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
    unmount()
    setup(5)
    expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument()
  })

  it('shows Finish on the last step and calls onFinish', async () => {
    const user = userEvent.setup()
    const handlers = setup(8)
    await user.click(screen.getByRole('button', { name: /finish/i }))
    expect(handlers.onFinish).toHaveBeenCalledOnce()
    expect(handlers.onNext).not.toHaveBeenCalled()
  })

  it('reports progress for assistive tech', () => {
    setup(3)
    expect(screen.getByText('3 of 8')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --project unit tests/unit/onboarding/wizard-chrome.test.tsx`
Expected: FAIL, cannot resolve the module.

- [ ] **Step 3: Write the component**

Create `app/(dashboard)/onboarding/wizard-chrome.tsx`:

```tsx
'use client'

import { ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

/** The eight steps of the welcome wizard. */
export type WelcomeStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export const TOTAL_STEPS = 8

/** Props for {@link WizardChrome}. */
export interface WizardChromeProps {
  step: WelcomeStep
  /** True while the step 3 save is in flight. */
  saving: boolean
  onBack: () => void
  onSkip: () => void
  onNext: () => void
  onFinish: () => void
}

/**
 * The wizard's pinned footer: progress on the left, navigation on the right.
 *
 * A thin bar rather than the branding wizard's numbered circles, which work
 * at three steps but crowd badly at eight on a narrow phone.
 */
export function WizardChrome({ step, saving, onBack, onSkip, onNext, onFinish }: WizardChromeProps) {
  const isLast = step === TOTAL_STEPS
  // Skip only makes sense where there is something to skip. Steps 4 to 8
  // have no input, so Next carries the screen alone.
  const canSkip = step === 2 || step === 3

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="h-1 w-24 sm:w-40 rounded-full bg-surface-muted overflow-hidden"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
        >
          <div
            className="h-full bg-brand transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
        <span className="text-xs text-text-subtle whitespace-nowrap">
          {step} of {TOTAL_STEPS}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {canSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={saving}
            className="text-xs text-text-muted hover:text-text cursor-pointer disabled:opacity-50 disabled:cursor-default transition"
          >
            Skip
          </button>
        )}
        {step > 1 && (
          <Button variant="ghost" size="sm" onClick={onBack} disabled={saving}>
            Back
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={isLast ? onFinish : onNext}
          disabled={saving}
          loading={saving}
          className="rounded-xl"
        >
          {isLast ? 'Finish' : 'Next'}
          {!isLast && <ChevronRight size={14} strokeWidth={1.5} />}
        </Button>
      </div>
    </div>
  )
}
```

The progress bar's `width` is the one permitted inline style: it is a computed value, not a design decision, and there is no Tailwind class for an arbitrary percentage.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run --project unit tests/unit/onboarding/wizard-chrome.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/onboarding/wizard-chrome.tsx" tests/unit/onboarding/wizard-chrome.test.tsx
git commit -m "feat(onboarding): wizard footer chrome and progress bar"
```

---

### Task 4: Form steps 2 and 3

The two data-collecting steps. Built together because they share a value shape and step 3 is where both are saved.

**Files:**
- Create: `app/(dashboard)/onboarding/steps/step-details.tsx`
- Create: `app/(dashboard)/onboarding/steps/step-links.tsx`
- Test: `tests/unit/onboarding/steps.test.tsx`

**Interfaces:**
- Consumes: `AddressAutocomplete`, `AddressValue` from Task 1.
- Produces:
  ```ts
  export interface WelcomeProfile {
    displayName: string
    businessName: string
    phone: string
    addressText: string
    addressLat: number | null
    addressLng: number | null
    mcSignatureName: string
    website: string
    instagramUrl: string
    facebookUrl: string
  }
  export interface StepFormProps {
    value: WelcomeProfile
    email: string
    onChange: (next: WelcomeProfile) => void
  }
  export function StepDetails(props: StepFormProps): JSX.Element

  export interface StepLinksProps {
    value: WelcomeProfile
    onChange: (next: WelcomeProfile) => void
  }
  export function StepLinks(props: StepLinksProps): JSX.Element
  ```
  `WelcomeProfile` is declared in `step-details.tsx` and re-imported by everything else, so there is one definition.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/onboarding/steps.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

import { StepDetails, type WelcomeProfile } from '@/app/(dashboard)/onboarding/steps/step-details'
import { StepLinks } from '@/app/(dashboard)/onboarding/steps/step-links'

const EMPTY: WelcomeProfile = {
  displayName: 'Sam Reed', businessName: 'Reed MC', phone: '',
  addressText: '', addressLat: null, addressLng: null,
  mcSignatureName: '', website: '', instagramUrl: '', facebookUrl: '',
}

describe('StepDetails', () => {
  it('prefills name and business name', () => {
    render(<StepDetails value={EMPTY} email="sam@reed.com" onChange={vi.fn()} />)
    expect(screen.getByLabelText('Your name')).toHaveValue('Sam Reed')
    expect(screen.getByLabelText('Business name')).toHaveValue('Reed MC')
  })

  it('shows email as read-only', () => {
    render(<StepDetails value={EMPTY} email="sam@reed.com" onChange={vi.fn()} />)
    const email = screen.getByLabelText('Email')
    expect(email).toHaveValue('sam@reed.com')
    expect(email).toHaveAttribute('readonly')
  })

  it('reports edits to the business name', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<StepDetails value={EMPTY} email="sam@reed.com" onChange={onChange} />)
    await user.type(screen.getByLabelText('Business name'), '!')
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY, businessName: 'Reed MC!' })
  })
})

describe('StepLinks', () => {
  it('reports edits to the website', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<StepLinks value={EMPTY} onChange={onChange} />)
    await user.type(screen.getByLabelText('Website'), 'x')
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY, website: 'x' })
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --project unit tests/unit/onboarding/steps.test.tsx`
Expected: FAIL, cannot resolve the modules.

- [ ] **Step 3: Write StepDetails**

Create `app/(dashboard)/onboarding/steps/step-details.tsx`:

```tsx
'use client'

import { AddressAutocomplete, type AddressValue } from '@/components/ui/address-autocomplete'
import { Input } from '@/components/ui/input'

/** Every profile field the welcome wizard can write. */
export interface WelcomeProfile {
  displayName: string
  businessName: string
  phone: string
  addressText: string
  addressLat: number | null
  addressLng: number | null
  mcSignatureName: string
  website: string
  instagramUrl: string
  facebookUrl: string
}

/** Props shared by the two form steps. */
export interface StepFormProps {
  value: WelcomeProfile
  /** The auth email. Read-only here, changed in Settings. */
  email: string
  onChange: (next: WelcomeProfile) => void
}

/**
 * Step 2: identity.
 *
 * Name and business name arrive prefilled from signup and stay editable,
 * because business name appears on every proposal and invoice and a typo
 * made at signup should be fixable here. Email is read-only: changing it
 * needs Supabase's confirmation round-trip, so an editable field would
 * appear to work and then quietly not take effect.
 */
export function StepDetails({ value, email, onChange }: StepFormProps) {
  const set = <K extends keyof WelcomeProfile>(key: K, next: WelcomeProfile[K]) =>
    onChange({ ...value, [key]: next })

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-text">Tell us about you</h2>
        <p className="text-sm text-text-muted mt-1">
          This appears on the proposals, invoices and contracts you send.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Your name"
          value={value.displayName}
          onChange={(e) => set('displayName', e.target.value)}
          placeholder="Your full name"
        />
        <Input label="Email" value={email} readOnly help="Change this in Settings." />
        <Input
          label="Business name"
          value={value.businessName}
          onChange={(e) => set('businessName', e.target.value)}
          placeholder="Your MC business name"
        />
        <Input
          label="Phone"
          value={value.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="+61 400 000 000"
        />
        <Input
          label="Signature name"
          value={value.mcSignatureName}
          onChange={(e) => set('mcSignatureName', e.target.value)}
          placeholder="Your full legal name"
          help="Used when you sign contracts."
        />
        <div className="sm:col-span-2">
          <AddressAutocomplete
            value={value.addressText}
            help="Used to calculate drive time to each event."
            onChange={(next: AddressValue) =>
              onChange({ ...value, addressText: next.text, addressLat: next.lat, addressLng: next.lng })
            }
            onSelect={(next: AddressValue) =>
              onChange({ ...value, addressText: next.text, addressLat: next.lat, addressLng: next.lng })
            }
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write StepLinks**

Create `app/(dashboard)/onboarding/steps/step-links.tsx`:

```tsx
'use client'

import { Input } from '@/components/ui/input'

import type { WelcomeProfile } from './step-details'

/** Props for {@link StepLinks}. */
export interface StepLinksProps {
  value: WelcomeProfile
  onChange: (next: WelcomeProfile) => void
}

/**
 * Step 3: where couples can find you.
 *
 * Split from step 2 so neither screen becomes a dense nine-field form.
 * Advancing from here is what saves both steps.
 */
export function StepLinks({ value, onChange }: StepLinksProps) {
  const set = <K extends keyof WelcomeProfile>(key: K, next: WelcomeProfile[K]) =>
    onChange({ ...value, [key]: next })

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-text">Where can couples find you?</h2>
        <p className="text-sm text-text-muted mt-1">
          All optional. You can add these later in Settings.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Website"
          value={value.website}
          onChange={(e) => set('website', e.target.value)}
          placeholder="https://yoursite.com"
        />
        <Input
          label="Instagram"
          value={value.instagramUrl}
          onChange={(e) => set('instagramUrl', e.target.value)}
          placeholder="https://instagram.com/yourhandle"
        />
        <Input
          label="Facebook"
          value={value.facebookUrl}
          onChange={(e) => set('facebookUrl', e.target.value)}
          placeholder="https://facebook.com/yourpage"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run --project unit tests/unit/onboarding/steps.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/onboarding/steps/" tests/unit/onboarding/steps.test.tsx
git commit -m "feat(onboarding): details and links form steps"
```

---

### Task 5: Welcome and founder steps

The two copy-only steps. Small, no state, no network.

**Files:**
- Create: `app/(dashboard)/onboarding/steps/step-welcome.tsx`
- Create: `app/(dashboard)/onboarding/steps/step-founder.tsx`
- Test: `tests/unit/onboarding/copy-steps.test.tsx`

**Interfaces:**
- Produces: `export function StepWelcome(): JSX.Element` and `export function StepFounder(): JSX.Element`. Neither takes props.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/onboarding/copy-steps.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { StepFounder } from '@/app/(dashboard)/onboarding/steps/step-founder'
import { StepWelcome } from '@/app/(dashboard)/onboarding/steps/step-welcome'

describe('StepWelcome', () => {
  it('names the product', () => {
    render(<StepWelcome />)
    expect(screen.getByRole('heading', { name: /welcome to zebri/i })).toBeInTheDocument()
  })
})

describe('StepFounder', () => {
  it('shows the founder note and signature', () => {
    render(<StepFounder />)
    expect(screen.getByRole('heading', { name: /a note from the founder/i })).toBeInTheDocument()
    expect(screen.getByText('Arjun Punekar')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --project unit tests/unit/onboarding/copy-steps.test.tsx`
Expected: FAIL, cannot resolve the modules.

- [ ] **Step 3: Write StepWelcome**

Create `app/(dashboard)/onboarding/steps/step-welcome.tsx`:

```tsx
'use client'

/**
 * Step 1: what Zebri is, in a breath.
 *
 * Deliberately short. The four previews that follow do the explaining.
 */
export function StepWelcome() {
  return (
    <div className="flex flex-col items-center justify-center text-center h-full gap-4 px-6">
      <h2 className="text-3xl font-semibold text-text">Welcome to Zebri</h2>
      <p className="text-sm text-text-muted max-w-md">
        Zebri is where wedding MCs run their business. Enquiries, proposals,
        contracts, payments and the couples themselves, all in one place.
      </p>
      <p className="text-sm text-text-subtle max-w-md">
        This takes about a minute. We will get your details down, then show
        you around.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Write StepFounder**

Create `app/(dashboard)/onboarding/steps/step-founder.tsx`:

```tsx
'use client'

import { User } from 'lucide-react'

/**
 * Step 8: a personal note to close on.
 *
 * The body copy below is placeholder. It must be replaced with real copy
 * before this ships to users. The photo and signature are placeholders in
 * the same sense: the layout reserves their space so dropping in the real
 * assets is a swap, not a redesign.
 */
export function StepFounder() {
  return (
    <div className="flex flex-col items-center text-center h-full justify-center gap-5 px-6">
      <div className="w-20 h-20 rounded-full bg-surface-muted border border-border flex items-center justify-center">
        <User size={28} strokeWidth={1.5} className="text-text-subtle" />
      </div>

      <h2 className="text-xl font-semibold text-text">A note from the founder</h2>

      <p className="text-sm text-text-muted max-w-md leading-relaxed">
        Thanks for giving Zebri a go. I built it because running an MC
        business off spreadsheets and a inbox is harder than the actual
        weddings. If something is missing or in your way, tell me. I read
        every message.
      </p>

      <div className="flex flex-col items-center gap-1 pt-2">
        <div className="h-8 w-32 rounded bg-surface-muted border border-border" aria-hidden />
        <span className="text-sm font-medium text-text">Arjun Punekar</span>
        <span className="text-xs text-text-subtle">Founder, Zebri</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run --project unit tests/unit/onboarding/copy-steps.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/onboarding/steps/step-welcome.tsx" "app/(dashboard)/onboarding/steps/step-founder.tsx" tests/unit/onboarding/copy-steps.test.tsx
git commit -m "feat(onboarding): welcome and founder note steps"
```

---

### Task 6: The wizard state machine and save

Ties the steps together, owns navigation, and performs the one write.

**Files:**
- Create: `app/(dashboard)/onboarding/welcome-wizard.tsx`
- Test: `tests/unit/onboarding/welcome-wizard.test.tsx`

**Interfaces:**
- Consumes: `WizardChrome`, `WelcomeStep`, `StepDetails`, `StepLinks`, `StepWelcome`, `StepFounder`, `WelcomeProfile`.
- Produces:
  ```ts
  export interface WelcomeWizardProps {
    initial: WelcomeProfile
    email: string
    onSaveProfile: (profile: WelcomeProfile) => Promise<{ ok: true } | { ok: false; message: string }>
    onExit: () => void
  }
  export function WelcomeWizard(props: WelcomeWizardProps): JSX.Element
  ```
  `onSaveProfile` is called exactly once, when leaving step 3 forward. `onExit` is called on Finish. Steps 4 to 7 render `StepPreview` from Task 8; until that task lands, they render a placeholder so this task is independently testable.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/onboarding/welcome-wizard.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

import { WelcomeWizard } from '@/app/(dashboard)/onboarding/welcome-wizard'
import type { WelcomeProfile } from '@/app/(dashboard)/onboarding/steps/step-details'

const INITIAL: WelcomeProfile = {
  displayName: 'Sam Reed', businessName: 'Reed MC', phone: '',
  addressText: '', addressLat: null, addressLng: null,
  mcSignatureName: '', website: '', instagramUrl: '', facebookUrl: '',
}

function setup(save = vi.fn().mockResolvedValue({ ok: true as const })) {
  const onExit = vi.fn()
  render(
    <WelcomeWizard initial={INITIAL} email="sam@reed.com" onSaveProfile={save} onExit={onExit} />,
  )
  return { save, onExit, user: userEvent.setup() }
}

const next = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /next/i }))

describe('WelcomeWizard', () => {
  it('saves once when leaving step 3, with the edited values', async () => {
    const { save, user } = setup()
    await next(user)                                     // 1 -> 2
    await user.type(screen.getByLabelText('Phone'), '0400')
    await next(user)                                     // 2 -> 3
    await user.type(screen.getByLabelText('Website'), 'z.com')
    await next(user)                                     // 3 -> 4, saves

    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(save).toHaveBeenCalledWith({ ...INITIAL, phone: '0400', website: 'z.com' })
  })

  it('does not save when moving between steps 1 and 2', async () => {
    const { save, user } = setup()
    await next(user)
    expect(save).not.toHaveBeenCalled()
  })

  it('advances and surfaces a message when the save fails', async () => {
    const save = vi.fn().mockResolvedValue({ ok: false as const, message: 'Network down' })
    const { user } = setup(save)
    await next(user)
    await next(user)
    await next(user)

    expect(await screen.findByText(/network down/i)).toBeInTheDocument()
    // The user is not trapped: the flow continues regardless.
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
  })

  it('calls onExit from Finish on the last step', async () => {
    const { onExit, user } = setup()
    for (let i = 0; i < 7; i++) await next(user)
    await user.click(screen.getByRole('button', { name: /finish/i }))
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('does not re-save when stepping back to 3 and forward again', async () => {
    const { save, user } = setup()
    await next(user); await next(user); await next(user)
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    await user.click(screen.getByRole('button', { name: /back/i }))
    await next(user)
    expect(save).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --project unit tests/unit/onboarding/welcome-wizard.test.tsx`
Expected: FAIL, cannot resolve the module.

- [ ] **Step 3: Write the wizard**

Create `app/(dashboard)/onboarding/welcome-wizard.tsx`:

```tsx
'use client'

import { useState } from 'react'

import { StepDetails, type WelcomeProfile } from './steps/step-details'
import { StepFounder } from './steps/step-founder'
import { StepLinks } from './steps/step-links'
import { StepWelcome } from './steps/step-welcome'
import { WizardChrome, TOTAL_STEPS, type WelcomeStep } from './wizard-chrome'

/** Result of persisting the profile. */
export type SaveResult = { ok: true } | { ok: false; message: string }

/** Props for {@link WelcomeWizard}. */
export interface WelcomeWizardProps {
  initial: WelcomeProfile
  email: string
  /** Called once, when the user leaves step 3 going forward. */
  onSaveProfile: (profile: WelcomeProfile) => Promise<SaveResult>
  /** Called when the user finishes the last step. */
  onExit: () => void
}

/**
 * The eight-step welcome wizard.
 *
 * The save happens on the way out of step 3 rather than at Finish. The two
 * halves of this flow have different drop-off profiles: someone who fills
 * in their details and then meets four screens of animation may well close
 * at step 4, and they should keep what they typed.
 */
export function WelcomeWizard({ initial, email, onSaveProfile, onExit }: WelcomeWizardProps) {
  const [step, setStep] = useState<WelcomeStep>(1)
  const [profile, setProfile] = useState<WelcomeProfile>(initial)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const goTo = (next: WelcomeStep) => setStep(next)

  const handleNext = async () => {
    // Leaving step 3 forward is the single save point. `saved` guards the
    // Back-then-Next path so a second pass does not write again.
    if (step === 3 && !saved) {
      setSaving(true)
      setSaveError(null)
      const result = await onSaveProfile(profile)
      setSaving(false)
      if (result.ok) {
        setSaved(true)
      } else {
        // A failed write never blocks the flow. These fields are optional
        // and all of them remain editable in Settings.
        setSaveError(result.message)
      }
    }
    goTo(Math.min(step + 1, TOTAL_STEPS) as WelcomeStep)
  }

  const handleBack = () => goTo(Math.max(step - 1, 1) as WelcomeStep)
  const handleSkip = () => goTo((step === 2 ? 3 : 4) as WelcomeStep)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-1 py-2">
        {step === 1 && <StepWelcome />}
        {step === 2 && <StepDetails value={profile} email={email} onChange={setProfile} />}
        {step === 3 && <StepLinks value={profile} onChange={setProfile} />}
        {step >= 4 && step <= 7 && (
          <div data-testid="preview-slot" className="h-full" />
        )}
        {step === 8 && <StepFounder />}

        {saveError && (
          <p className="mt-4 text-sm text-text-muted">
            We could not save your details just now ({saveError}). You can add
            them any time in Settings.
          </p>
        )}
      </div>

      <div className="border-t border-border pt-4 mt-2">
        <WizardChrome
          step={step}
          saving={saving}
          onBack={handleBack}
          onSkip={handleSkip}
          onNext={() => void handleNext()}
          onFinish={onExit}
        />
      </div>
    </div>
  )
}
```

Note the `preview-slot` placeholder: Task 8 replaces it with `StepPreview`. Leaving it as a marked slot keeps this task independently testable.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run --project unit tests/unit/onboarding/welcome-wizard.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/onboarding/welcome-wizard.tsx" tests/unit/onboarding/welcome-wizard.test.tsx
git commit -m "feat(onboarding): wizard state machine and profile save"
```

---

### Task 7: Modal shell, gate, and mount

Wires the wizard to real Supabase data and decides when it appears.

**Files:**
- Create: `app/(dashboard)/onboarding/welcome-modal.tsx`
- Create: `app/(dashboard)/onboarding/welcome-gate.tsx`
- Modify: `app/(dashboard)/layout.tsx`
- Test: `tests/unit/onboarding/welcome-modal.test.tsx`

**Interfaces:**
- Consumes: `WelcomeWizard`, `WelcomeProfile`, `SaveResult`.
- Produces:
  ```ts
  export const WELCOME_CACHE_KEY = 'zebri:welcome-onboarded'
  export interface WelcomeModalProps {
    isOpen: boolean
    initial: WelcomeProfile
    email: string
    onSaveProfile: (profile: WelcomeProfile) => Promise<SaveResult>
    onDismiss: () => void
  }
  export function WelcomeModal(props: WelcomeModalProps): JSX.Element
  export function WelcomeGate(): JSX.Element | null
  ```
  `onDismiss` fires on every exit path: Finish, Escape, the close control and the backdrop.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/onboarding/welcome-modal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

import { WelcomeModal } from '@/app/(dashboard)/onboarding/welcome-modal'
import type { WelcomeProfile } from '@/app/(dashboard)/onboarding/steps/step-details'

const INITIAL: WelcomeProfile = {
  displayName: 'Sam Reed', businessName: 'Reed MC', phone: '',
  addressText: '', addressLat: null, addressLng: null,
  mcSignatureName: '', website: '', instagramUrl: '', facebookUrl: '',
}

describe('WelcomeModal', () => {
  it('is dismissible with Escape and reports the dismissal', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(
      <WelcomeModal
        isOpen
        initial={INITIAL}
        email="sam@reed.com"
        onSaveProfile={vi.fn().mockResolvedValue({ ok: true })}
        onDismiss={onDismiss}
      />,
    )
    expect(screen.getByRole('heading', { name: /welcome to zebri/i })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('renders nothing when closed', () => {
    render(
      <WelcomeModal
        isOpen={false}
        initial={INITIAL}
        email="sam@reed.com"
        onSaveProfile={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.queryByRole('heading', { name: /welcome to zebri/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --project unit tests/unit/onboarding/welcome-modal.test.tsx`
Expected: FAIL, cannot resolve the module.

- [ ] **Step 3: Write the modal shell**

Create `app/(dashboard)/onboarding/welcome-modal.tsx`:

```tsx
'use client'

import { Modal } from '@/components/ui/modal'

import { WelcomeWizard, type SaveResult } from './welcome-wizard'
import type { WelcomeProfile } from './steps/step-details'

/** localStorage hint that stops the modal flashing on a slow hydrate. */
export const WELCOME_CACHE_KEY = 'zebri:welcome-onboarded'

/** Props for {@link WelcomeModal}. */
export interface WelcomeModalProps {
  isOpen: boolean
  initial: WelcomeProfile
  email: string
  onSaveProfile: (profile: WelcomeProfile) => Promise<SaveResult>
  /** Fires on every exit path: Finish, Escape, close control, backdrop. */
  onDismiss: () => void
}

/**
 * The welcome wizard's shell.
 *
 * Unlike the branding wizard this modal is dismissible. These are paying
 * users who signed up on purpose and will mostly finish it anyway, and a
 * hard gate would turn any one broken step into a lockout from a product
 * they just paid for.
 *
 * The fixed height lives on this inner wrapper rather than the Modal,
 * which hard-caps itself at max-h-[85vh]. Without it the frame would jump
 * between a short form step and a tall preview step.
 */
export function WelcomeModal({
  isOpen,
  initial,
  email,
  onSaveProfile,
  onDismiss,
}: WelcomeModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onDismiss} size="xl">
      <div className="h-[560px] sm:h-[680px] max-h-full flex flex-col">
        <WelcomeWizard
          initial={initial}
          email={email}
          onSaveProfile={onSaveProfile}
          onExit={onDismiss}
        />
      </div>
    </Modal>
  )
}
```

- [ ] **Step 4: Write the gate**

Create `app/(dashboard)/onboarding/welcome-gate.tsx`:

```tsx
'use client'

import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

import { WelcomeModal, WELCOME_CACHE_KEY } from './welcome-modal'
import type { WelcomeProfile } from './steps/step-details'
import type { SaveResult } from './welcome-wizard'

function toProfile(user: User): WelcomeProfile {
  const m = (user.user_metadata ?? {}) as Record<string, unknown>
  const str = (key: string) => (typeof m[key] === 'string' ? (m[key] as string) : '')
  const num = (key: string) => (typeof m[key] === 'number' ? (m[key] as number) : null)
  return {
    displayName: str('display_name'),
    businessName: str('business_name'),
    phone: str('phone'),
    addressText: str('address_text'),
    addressLat: num('address_lat'),
    addressLng: num('address_lng'),
    mcSignatureName: str('mc_signature_name'),
    website: str('website'),
    instagramUrl: str('instagram_url'),
    facebookUrl: str('facebook_url'),
  }
}

/**
 * Decides whether the welcome wizard appears.
 *
 * The flag lives in `user_metadata` rather than a table: it rides in the
 * JWT, so the gate costs no query and no migration. It is not an
 * entitlement, so the app_metadata rule in authentication.md does not
 * apply. A user who cleared it would simply see the wizard again.
 */
export function WelcomeGate() {
  const [user, setUser] = useState<User | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // The localStorage hint suppresses the modal synchronously for the
    // common case (already onboarded), so it cannot flash during the
    // getUser round-trip.
    if (localStorage.getItem(WELCOME_CACHE_KEY) === 'true') return
    let cancelled = false
    void (async () => {
      const { data } = await createClient().auth.getUser()
      if (cancelled || !data.user) return
      const done = Boolean((data.user.user_metadata ?? {}).welcome_onboarded_at)
      if (done) {
        localStorage.setItem(WELCOME_CACHE_KEY, 'true')
        return
      }
      setUser(data.user)
      setOpen(true)
    })()
    return () => { cancelled = true }
  }, [])

  if (!user) return null

  const saveProfile = async (profile: WelcomeProfile): Promise<SaveResult> => {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      data: {
        ...(user.user_metadata ?? {}),
        display_name: profile.displayName,
        business_name: profile.businessName,
        phone: profile.phone,
        website: profile.website,
        instagram_url: profile.instagramUrl,
        facebook_url: profile.facebookUrl,
        mc_signature_name: profile.mcSignatureName,
        address_text: profile.addressText,
        address_lat: profile.addressLat,
        address_lng: profile.addressLng,
      },
    })
    return error ? { ok: false, message: error.message } : { ok: true }
  }

  const dismiss = () => {
    setOpen(false)
    // Stamp locally first so the modal cannot reappear on the next route
    // change even if the write is slow or fails.
    localStorage.setItem(WELCOME_CACHE_KEY, 'true')
    void createClient().auth.updateUser({
      data: { ...(user.user_metadata ?? {}), welcome_onboarded_at: new Date().toISOString() },
    })
  }

  return (
    <WelcomeModal
      isOpen={open}
      initial={toProfile(user)}
      email={user.email ?? ''}
      onSaveProfile={saveProfile}
      onDismiss={dismiss}
    />
  )
}
```

- [ ] **Step 5: Mount it**

In `app/(dashboard)/layout.tsx`, add the import and render it inside `SidebarLayout` alongside `ShadowBanner`:

```tsx
import { WelcomeGate } from './onboarding/welcome-gate'
```

```tsx
    <SidebarLayout>
      <ShadowBanner />
      <WelcomeGate />
      <div className="flex-1 overflow-hidden min-h-0">
        {children}
      </div>
      {modal}
    </SidebarLayout>
```

Mounting in the layout rather than the dashboard page means the wizard appears wherever a new user first lands, which matters because signup redirects to `/` but a deep link would not.

- [ ] **Step 6: Run the tests and typecheck**

Run: `npx vitest run --project unit tests/unit/onboarding/welcome-modal.test.tsx`
Expected: PASS, 2 tests.

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 7: Verify in the running app**

Start the app, clear the flag for your test user (in the browser console: `localStorage.removeItem('zebri:welcome-onboarded')`, and clear `welcome_onboarded_at` from that user's metadata), reload, and confirm: the modal appears, the eight steps walk, Escape closes it, and it does not come back after a reload.

- [ ] **Step 8: Commit**

```bash
git add "app/(dashboard)/onboarding/welcome-modal.tsx" "app/(dashboard)/onboarding/welcome-gate.tsx" "app/(dashboard)/layout.tsx" tests/unit/onboarding/welcome-modal.test.tsx
git commit -m "feat(onboarding): welcome modal shell and first-login gate"
```

---

### Task 8: Preview chassis and step host

The miniature Zebri window every preview animates inside, plus the step wrapper that gives each preview its heading and copy.

**Files:**
- Create: `app/(dashboard)/onboarding/previews/preview-frame.tsx`
- Create: `app/(dashboard)/onboarding/steps/step-preview.tsx`
- Modify: `app/(dashboard)/onboarding/welcome-wizard.tsx`
- Test: `tests/unit/onboarding/preview-frame.test.tsx`

**Interfaces:**
- Consumes: `usePreviewScript`, `useReducedMotion`, `WelcomeStep`.
- Produces:
  ```ts
  export type NavKey = 'couples' | 'templates' | 'automations'
  export interface PreviewFrameProps {
    activeNav: NavKey
    /** True once the sidebar click beat has landed. */
    navClicked: boolean
    children: React.ReactNode
  }
  export function PreviewFrame(props: PreviewFrameProps): JSX.Element

  export interface PreviewScriptProps { active: boolean; reducedMotion: boolean }
  export interface StepPreviewProps { step: 4 | 5 | 6 | 7; active: boolean }
  export function StepPreview(props: StepPreviewProps): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `tests/unit/onboarding/preview-frame.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { PreviewFrame } from '@/app/(dashboard)/onboarding/previews/preview-frame'

describe('PreviewFrame', () => {
  it('renders the sidebar rail and its content', () => {
    render(
      <PreviewFrame activeNav="couples" navClicked>
        <div>content here</div>
      </PreviewFrame>,
    )
    expect(screen.getByText('Couples')).toBeInTheDocument()
    expect(screen.getByText('Templates')).toBeInTheDocument()
    expect(screen.getByText('Automations')).toBeInTheDocument()
    expect(screen.getByText('content here')).toBeInTheDocument()
  })

  it('marks the active nav item once clicked', () => {
    render(
      <PreviewFrame activeNav="automations" navClicked>
        <div />
      </PreviewFrame>,
    )
    expect(screen.getByText('Automations')).toHaveAttribute('data-active', 'true')
    expect(screen.getByText('Couples')).toHaveAttribute('data-active', 'false')
  })

  it('leaves nothing active before the click beat', () => {
    render(
      <PreviewFrame activeNav="automations" navClicked={false}>
        <div />
      </PreviewFrame>,
    )
    expect(screen.getByText('Automations')).toHaveAttribute('data-active', 'false')
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --project unit tests/unit/onboarding/preview-frame.test.tsx`
Expected: FAIL, cannot resolve the module.

- [ ] **Step 3: Write PreviewFrame**

Create `app/(dashboard)/onboarding/previews/preview-frame.tsx`:

```tsx
'use client'

import { Users, FileText, Workflow } from 'lucide-react'
import type { ReactNode } from 'react'

/** Sidebar destinations a preview can navigate to. */
export type NavKey = 'couples' | 'templates' | 'automations'

/** Props implemented by every preview script. */
export interface PreviewScriptProps {
  /** True when this preview's step is on screen. */
  active: boolean
  reducedMotion: boolean
}

/** Props for {@link PreviewFrame}. */
export interface PreviewFrameProps {
  activeNav: NavKey
  /** True once the sidebar click beat has landed. */
  navClicked: boolean
  children: ReactNode
}

const NAV = [
  { key: 'couples' as const, label: 'Couples', Icon: Users },
  { key: 'templates' as const, label: 'Templates', Icon: FileText },
  { key: 'automations' as const, label: 'Automations', Icon: Workflow },
]

/**
 * A miniature Zebri window: sidebar rail on the left, content on the right.
 *
 * All four previews share this chassis so the set reads as one product
 * rather than four unrelated cartoons. On phones the rail collapses to
 * icons, because three labels plus a content area at 393px is mush.
 */
export function PreviewFrame({ activeNav, navClicked, children }: PreviewFrameProps) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex h-[260px] sm:h-[320px] shadow-sm">
      <nav className="w-14 sm:w-36 shrink-0 border-r border-border bg-surface-muted py-3 px-2 flex flex-col gap-1">
        {NAV.map(({ key, label, Icon }) => {
          const on = navClicked && key === activeNav
          return (
            <span
              key={key}
              data-active={on ? 'true' : 'false'}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors duration-300 ${
                on ? 'bg-card text-text font-medium' : 'text-text-subtle'
              }`}
            >
              <Icon size={14} strokeWidth={1.5} className="shrink-0" />
              <span className="hidden sm:inline truncate">{label}</span>
            </span>
          )
        })}
      </nav>
      <div className="flex-1 min-w-0 p-3 sm:p-4 relative overflow-hidden">{children}</div>
    </div>
  )
}
```

The label text renders on all breakpoints (hidden visually on mobile via `hidden sm:inline`) so the tests above can query by text at any width.

- [ ] **Step 4: Write StepPreview**

Create `app/(dashboard)/onboarding/steps/step-preview.tsx`:

```tsx
'use client'

import { useReducedMotion } from '../use-reduced-motion'
import { ScriptAutomation } from '../previews/script-automation'
import { ScriptCouple } from '../previews/script-couple'
import { ScriptSend } from '../previews/script-send'
import { ScriptTemplate } from '../previews/script-template'

/** Props for {@link StepPreview}. */
export interface StepPreviewProps {
  step: 4 | 5 | 6 | 7
  /** True when this step is the one on screen. */
  active: boolean
}

const CONTENT = {
  4: {
    title: 'Add a couple',
    body: 'Every booking starts here. Add the couple, their date and their venue, and Zebri tracks them from enquiry to wedding day.',
  },
  5: {
    title: 'Create a template',
    body: 'Write an email once and reuse it forever. Variables like the couple name fill themselves in when you send.',
  },
  6: {
    title: 'Send it in two clicks',
    body: 'Open a couple, pick a template, send. No copying, no pasting, and every send is logged against that couple.',
  },
  7: {
    title: 'Let it run itself',
    body: 'Set it up once and every new enquiry gets that email automatically, whether you are at a wedding or asleep.',
  },
}

/**
 * Host for the four preview steps: heading, one line of copy, and the
 * animated mock. The scripts know nothing about the wizard and the wizard
 * knows nothing about how they animate.
 */
export function StepPreview({ step, active }: StepPreviewProps) {
  const reducedMotion = useReducedMotion()
  const { title, body } = CONTENT[step]
  const scriptProps = { active, reducedMotion }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-text">{title}</h2>
        <p className="text-sm text-text-muted mt-1 max-w-lg">{body}</p>
      </div>
      {step === 4 && <ScriptCouple {...scriptProps} />}
      {step === 5 && <ScriptTemplate {...scriptProps} />}
      {step === 6 && <ScriptSend {...scriptProps} />}
      {step === 7 && <ScriptAutomation {...scriptProps} />}
    </div>
  )
}
```

- [ ] **Step 5: Wire it into the wizard**

In `app/(dashboard)/onboarding/welcome-wizard.tsx`, add the import:

```tsx
import { StepPreview } from './steps/step-preview'
```

and replace the placeholder slot:

```tsx
        {step >= 4 && step <= 7 && (
          <StepPreview step={step as 4 | 5 | 6 | 7} active />
        )}
```

`active` is always true here because the step only mounts when it is on screen, and unmounting is what resets the beat counter for a replay.

- [ ] **Step 6: Run the tests**

Tasks 9 to 12 create the four scripts. Until then this will not compile, so create four temporary stubs to keep the tree green, each in its final path:

```tsx
// app/(dashboard)/onboarding/previews/script-couple.tsx (temporary)
'use client'
import type { PreviewScriptProps } from './preview-frame'
export function ScriptCouple(_props: PreviewScriptProps) { return null }
```

Repeat for `script-template.tsx` (`ScriptTemplate`), `script-send.tsx` (`ScriptSend`) and `script-automation.tsx` (`ScriptAutomation`). Each is replaced in full by its own task.

Run: `npx vitest run --project unit tests/unit/onboarding/`
Expected: PASS, all onboarding tests.

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/onboarding/previews/" "app/(dashboard)/onboarding/steps/step-preview.tsx" "app/(dashboard)/onboarding/welcome-wizard.tsx" tests/unit/onboarding/preview-frame.test.tsx
git commit -m "feat(onboarding): preview chassis and step host"
```

---

### Task 9: Preview 4, add a couple

**Files:**
- Create (replacing the stub): `app/(dashboard)/onboarding/previews/script-couple.tsx`
- Test: `tests/unit/onboarding/script-couple.test.tsx`

**Interfaces:**
- Consumes: `PreviewFrame`, `PreviewScriptProps`, `usePreviewScript`.
- Produces: `export function ScriptCouple(props: PreviewScriptProps): JSX.Element`

**Reference screens:** `app/(dashboard)/couples/couples-header.tsx:109` (the New couple button and its "Add manually" item) and `app/(dashboard)/couples/couple-modal.tsx:32` (field order: Name, Primary contact, wedding date, venue).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/onboarding/script-couple.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { ScriptCouple } from '@/app/(dashboard)/onboarding/previews/script-couple'

describe('ScriptCouple', () => {
  it('shows the finished state immediately under reduced motion', () => {
    render(<ScriptCouple active reducedMotion />)
    // Final beat: the saved couple row is on screen.
    expect(screen.getByText('Ellie & Tom')).toBeInTheDocument()
    expect(screen.getByText('Couples')).toHaveAttribute('data-active', 'true')
  })

  it('starts from an empty frame when inactive', () => {
    render(<ScriptCouple active={false} reducedMotion={false} />)
    expect(screen.queryByText('Ellie & Tom')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --project unit tests/unit/onboarding/script-couple.test.tsx`
Expected: FAIL, the stub renders null so `Ellie & Tom` is absent.

- [ ] **Step 3: Write the script**

Replace `app/(dashboard)/onboarding/previews/script-couple.tsx`:

```tsx
'use client'

import { Plus } from 'lucide-react'

import { PreviewFrame, type PreviewScriptProps } from './preview-frame'
import { usePreviewScript } from './use-preview-script'

/**
 * Beats: 0 idle, 1 sidebar click, 2 New couple menu, 3 Add manually,
 * 4 name typed, 5 date typed, 6 Save pressed, 7 row lands.
 */
const BEATS = 8

/**
 * Preview for step 4: adding a couple.
 *
 * Real labels, invented data. The couple created here is the same one
 * emailed in the step 6 preview, so the four previews read as one story.
 */
export function ScriptCouple({ active, reducedMotion }: PreviewScriptProps) {
  const beat = usePreviewScript({ beats: BEATS, active, reducedMotion })
  const show = (from: number) => beat >= from

  return (
    <PreviewFrame activeNav="couples" navClicked={show(1)}>
      <div className="relative h-full">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-text">Couples</span>
          <span
            className={`inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs transition-colors duration-300 ${
              show(2) ? 'bg-brand text-text-inverse border-transparent' : 'text-text-subtle'
            }`}
          >
            <Plus size={12} strokeWidth={1.5} />
            New couple
          </span>
        </div>

        {show(2) && !show(3) && (
          <div className="absolute right-0 top-9 z-10 w-32 rounded-lg border border-border bg-card shadow-sm py-1 animate-fade-in">
            <p className="px-2 py-1 text-xs text-text font-medium">Add manually</p>
            <p className="px-2 py-1 text-xs text-text-subtle">Import from CSV</p>
          </div>
        )}

        {show(3) && !show(7) && (
          <div className="rounded-lg border border-border bg-card p-3 space-y-2 animate-fade-in">
            <p className="text-xs font-medium text-text">Add couple</p>
            <MockField label="Name" value={show(4) ? 'Ellie & Tom' : ''} />
            <MockField label="Wedding date" value={show(5) ? '14 Mar 2027' : ''} />
            <div className="flex justify-end pt-1">
              <span
                className={`rounded-lg px-3 py-1 text-xs transition-colors duration-300 ${
                  show(6) ? 'bg-brand text-text-inverse' : 'bg-surface-muted text-text-subtle'
                }`}
              >
                Save
              </span>
            </div>
          </div>
        )}

        {show(7) && (
          <div className="rounded-lg border border-border bg-card px-3 py-2 flex items-center justify-between animate-fade-in">
            <div>
              <p className="text-xs font-medium text-text">Ellie &amp; Tom</p>
              <p className="text-[10px] text-text-subtle">14 Mar 2027</p>
            </div>
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] text-text-muted">
              Enquiry
            </span>
          </div>
        )}
      </div>
    </PreviewFrame>
  )
}

/** A miniature labelled field with a typing caret. */
function MockField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-text-subtle mb-0.5">{label}</p>
      <div className="h-6 rounded border border-border bg-surface px-2 flex items-center">
        <span className="text-xs text-text">{value}</span>
        {!value && <span className="w-px h-3 bg-text-subtle animate-pulse" />}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run --project unit tests/unit/onboarding/script-couple.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Verify the resemblance against the real screen**

This is the step that matters and it cannot be automated. Open the running app at `/couples` on one side and the wizard at step 4 on the other. Compare: is the New couple button in the same corner, is the menu wording identical ("Add manually", "Import from CSV"), do the modal's first two fields match `couple-modal.tsx`, does the saved row resemble a real couples row? Fix what does not match. Then check the same at Pixel 5 width and confirm nothing overflows.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/onboarding/previews/script-couple.tsx" tests/unit/onboarding/script-couple.test.tsx
git commit -m "feat(onboarding): add-a-couple preview"
```

---

### Task 10: Preview 5, create a template

**Files:**
- Create (replacing the stub): `app/(dashboard)/onboarding/previews/script-template.tsx`
- Test: `tests/unit/onboarding/script-template.test.tsx`

**Interfaces:**
- Consumes: `PreviewFrame`, `PreviewScriptProps`, `usePreviewScript`.
- Produces: `export function ScriptTemplate(props: PreviewScriptProps): JSX.Element`

**Reference screens:** `app/(dashboard)/templates/emails-tab.tsx:57` (two-pane library plus preview, the "New template" button) and `types/email-template.ts:74` (a template has name, subject and content).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/onboarding/script-template.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { ScriptTemplate } from '@/app/(dashboard)/onboarding/previews/script-template'

describe('ScriptTemplate', () => {
  it('shows the finished template under reduced motion', () => {
    render(<ScriptTemplate active reducedMotion />)
    expect(screen.getByText('Enquiry reply')).toBeInTheDocument()
    expect(screen.getByText('{{couple.name}}')).toBeInTheDocument()
    expect(screen.getByText('Templates')).toHaveAttribute('data-active', 'true')
  })

  it('shows nothing typed when inactive', () => {
    render(<ScriptTemplate active={false} reducedMotion={false} />)
    expect(screen.queryByText('{{couple.name}}')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --project unit tests/unit/onboarding/script-template.test.tsx`
Expected: FAIL, the stub renders null.

- [ ] **Step 3: Write the script**

Replace `app/(dashboard)/onboarding/previews/script-template.tsx`:

```tsx
'use client'

import { Plus } from 'lucide-react'

import { PreviewFrame, type PreviewScriptProps } from './preview-frame'
import { usePreviewScript } from './use-preview-script'

/**
 * Beats: 0 idle, 1 sidebar click, 2 New template, 3 name typed,
 * 4 subject typed, 5 variable chip resolves, 6 body fills, 7 saved.
 */
const BEATS = 8

/**
 * Preview for step 5: writing a reusable email template.
 *
 * The variable chip is the point of this preview, so it gets its own beat
 * rather than appearing as part of the subject line.
 */
export function ScriptTemplate({ active, reducedMotion }: PreviewScriptProps) {
  const beat = usePreviewScript({ beats: BEATS, active, reducedMotion })
  const show = (from: number) => beat >= from

  return (
    <PreviewFrame activeNav="templates" navClicked={show(1)}>
      <div className="flex gap-3 h-full">
        <div className="w-24 sm:w-28 shrink-0 space-y-1.5">
          <span
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] transition-colors duration-300 ${
              show(2) ? 'bg-brand text-text-inverse' : 'border border-border text-text-subtle'
            }`}
          >
            <Plus size={10} strokeWidth={1.5} />
            New template
          </span>
          {show(7) && (
            <div className="rounded border border-border bg-surface-muted px-2 py-1 animate-fade-in">
              <p className="text-[10px] font-medium text-text truncate">Enquiry reply</p>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 rounded-lg border border-border bg-card p-3 space-y-2">
          {show(3) && (
            <p className="text-xs font-medium text-text animate-fade-in">Enquiry reply</p>
          )}
          {show(4) && (
            <div className="animate-fade-in">
              <p className="text-[10px] text-text-subtle mb-0.5">Subject</p>
              <div className="rounded border border-border bg-surface px-2 py-1 text-xs text-text flex flex-wrap items-center gap-1">
                <span>Thanks for getting in touch,</span>
                {show(5) && (
                  <span className="rounded bg-brand-soft px-1 py-0.5 text-[10px] text-brand animate-fade-in">
                    {'{{couple.name}}'}
                  </span>
                )}
              </div>
            </div>
          )}
          {show(6) && (
            <div className="space-y-1 animate-fade-in">
              <div className="h-1.5 w-full rounded bg-surface-muted" />
              <div className="h-1.5 w-5/6 rounded bg-surface-muted" />
              <div className="h-1.5 w-2/3 rounded bg-surface-muted" />
            </div>
          )}
        </div>
      </div>
    </PreviewFrame>
  )
}
```

If `bg-brand-soft` is not a token in `.claude/docs/frontend-design.md`, substitute the nearest documented brand-tint token. Do not introduce an arbitrary-value colour: `zebri/no-off-token-color` will flag it.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run --project unit tests/unit/onboarding/script-template.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Verify the resemblance against the real screen**

Open `/templates` beside step 5. Compare the two-pane split, the New template button, and how a variable chip actually renders in the editor. Match the chip's shape and colour to the real one, since that is the detail a user will recognise. Check Pixel 5 width.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/onboarding/previews/script-template.tsx" tests/unit/onboarding/script-template.test.tsx
git commit -m "feat(onboarding): create-a-template preview"
```

---

### Task 11: Preview 6, send it

**Files:**
- Create (replacing the stub): `app/(dashboard)/onboarding/previews/script-send.tsx`
- Test: `tests/unit/onboarding/script-send.test.tsx`

**Interfaces:**
- Consumes: `PreviewFrame`, `PreviewScriptProps`, `usePreviewScript`.
- Produces: `export function ScriptSend(props: PreviewScriptProps): JSX.Element`

**Reference screens:** `app/(dashboard)/couples/couple-emails.tsx:72` (the Emails tab with Test and Send email buttons plus the history list), `couple-template-picker.tsx:56` (the popover), `couple-send-email.tsx:54` (the send modal).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/onboarding/script-send.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { ScriptSend } from '@/app/(dashboard)/onboarding/previews/script-send'

describe('ScriptSend', () => {
  it('ends on a sent email in the history', () => {
    render(<ScriptSend active reducedMotion />)
    expect(screen.getByText('Sent')).toBeInTheDocument()
    expect(screen.getByText('Enquiry reply')).toBeInTheDocument()
    expect(screen.getByText('Couples')).toHaveAttribute('data-active', 'true')
  })

  it('shows no history when inactive', () => {
    render(<ScriptSend active={false} reducedMotion={false} />)
    expect(screen.queryByText('Sent')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --project unit tests/unit/onboarding/script-send.test.tsx`
Expected: FAIL, the stub renders null.

- [ ] **Step 3: Write the script**

Replace `app/(dashboard)/onboarding/previews/script-send.tsx`:

```tsx
'use client'

import { Mail } from 'lucide-react'

import { PreviewFrame, type PreviewScriptProps } from './preview-frame'
import { usePreviewScript } from './use-preview-script'

/**
 * Beats: 0 idle, 1 sidebar click, 2 couple opened, 3 Emails tab,
 * 4 Send email pressed, 5 template picked, 6 send modal, 7 sent row.
 */
const BEATS = 8

/**
 * Preview for step 6: sending the template to the couple.
 *
 * Reuses the names from previews 4 and 5 on purpose. Seeing "Ellie & Tom"
 * receive "Enquiry reply" is what makes the four previews one story rather
 * than four disconnected demos.
 */
export function ScriptSend({ active, reducedMotion }: PreviewScriptProps) {
  const beat = usePreviewScript({ beats: BEATS, active, reducedMotion })
  const show = (from: number) => beat >= from

  return (
    <PreviewFrame activeNav="couples" navClicked={show(1)}>
      <div className="relative h-full space-y-2">
        {show(2) && (
          <p className="text-sm font-medium text-text animate-fade-in">Ellie &amp; Tom</p>
        )}

        {show(3) && (
          <div className="flex gap-3 border-b border-border pb-1 animate-fade-in">
            <span className="text-[10px] text-text-subtle">Overview</span>
            <span className="text-[10px] text-text font-medium border-b-2 border-brand pb-1">
              Emails
            </span>
            <span className="text-[10px] text-text-subtle">Tasks</span>
          </div>
        )}

        {show(3) && (
          <div className="flex justify-end animate-fade-in">
            <span
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] transition-colors duration-300 ${
                show(4) ? 'bg-brand text-text-inverse' : 'border border-border text-text-subtle'
              }`}
            >
              <Mail size={10} strokeWidth={1.5} />
              Send email
            </span>
          </div>
        )}

        {show(4) && !show(5) && (
          <div className="absolute right-0 top-16 z-10 w-32 rounded-lg border border-border bg-card shadow-sm py-1 animate-fade-in">
            <p className="px-2 py-0.5 text-[9px] text-text-subtle">Pick a template</p>
            <p className="px-2 py-1 text-[10px] text-text font-medium">Enquiry reply</p>
          </div>
        )}

        {show(5) && !show(7) && (
          <div className="rounded-lg border border-border bg-card p-2.5 space-y-1.5 animate-fade-in">
            <p className="text-[10px] font-medium text-text">Send email to Ellie &amp; Tom</p>
            <div className="rounded border border-border bg-surface px-2 py-1 text-[10px] text-text">
              Thanks for getting in touch, Ellie &amp; Tom
            </div>
            <div className="space-y-1">
              <div className="h-1.5 w-full rounded bg-surface-muted" />
              <div className="h-1.5 w-4/5 rounded bg-surface-muted" />
            </div>
            <div className="flex justify-end">
              <span
                className={`rounded-lg px-2.5 py-0.5 text-[10px] transition-colors duration-300 ${
                  show(6) ? 'bg-brand text-text-inverse' : 'bg-surface-muted text-text-subtle'
                }`}
              >
                Send
              </span>
            </div>
          </div>
        )}

        {show(7) && (
          <div className="rounded-lg border border-border bg-card px-2.5 py-2 flex items-center justify-between animate-fade-in">
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-text truncate">Enquiry reply</p>
              <p className="text-[9px] text-text-subtle truncate">to ellie@example.com</p>
            </div>
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[9px] text-text-muted">
              Sent
            </span>
          </div>
        )}
      </div>
    </PreviewFrame>
  )
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run --project unit tests/unit/onboarding/script-send.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Verify the resemblance against the real screen**

Open a real couple's Emails tab beside step 6. This preview has the most beats and the most chance of feeling rushed, so watch it end to end at least twice: can you follow what happened, or does it blur? If it blurs, raise `beatMs` for this script specifically rather than cutting a beat. Check Pixel 5 width, where the popover is most likely to overflow.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/onboarding/previews/script-send.tsx" tests/unit/onboarding/script-send.test.tsx
git commit -m "feat(onboarding): send-a-template preview"
```

---

### Task 12: Preview 7, automate it

**Files:**
- Create (replacing the stub): `app/(dashboard)/onboarding/previews/script-automation.tsx`
- Test: `tests/unit/onboarding/script-automation.test.tsx`

**Interfaces:**
- Consumes: `PreviewFrame`, `PreviewScriptProps`, `usePreviewScript`.
- Produces: `export function ScriptAutomation(props: PreviewScriptProps): JSX.Element`

**Reference screens:** `app/(dashboard)/automations/[id]/trigger-picker.tsx:33` and `action-picker.tsx:80`. The strings are fixed: the trigger label is "New enquiry" (`new_enquiry` in `types/automations.ts:45`) and the action label is "Send email" (`send_email` in `lib/automations/actions/ui.ts:39`). Use those exact words.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/onboarding/script-automation.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { ScriptAutomation } from '@/app/(dashboard)/onboarding/previews/script-automation'

describe('ScriptAutomation', () => {
  it('ends with the real trigger and action labels', () => {
    render(<ScriptAutomation active reducedMotion />)
    expect(screen.getByText('New enquiry')).toBeInTheDocument()
    expect(screen.getByText('Send email')).toBeInTheDocument()
    expect(screen.getByText('Automations')).toHaveAttribute('data-active', 'true')
  })

  it('shows an empty canvas when inactive', () => {
    render(<ScriptAutomation active={false} reducedMotion={false} />)
    expect(screen.queryByText('Send email')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --project unit tests/unit/onboarding/script-automation.test.tsx`
Expected: FAIL, the stub renders null.

- [ ] **Step 3: Write the script**

Replace `app/(dashboard)/onboarding/previews/script-automation.tsx`:

```tsx
'use client'

import { Mail, Zap } from 'lucide-react'

import { PreviewFrame, type PreviewScriptProps } from './preview-frame'
import { usePreviewScript } from './use-preview-script'

/**
 * Beats: 0 idle, 1 sidebar click, 2 empty canvas, 3 trigger chosen,
 * 4 connector draws, 5 action chosen, 6 toggled on.
 */
const BEATS = 7

/**
 * Preview for step 7: the automation that sends the template on its own.
 *
 * "New enquiry" and "Send email" are the real labels from
 * types/automations.ts and lib/automations/actions/ui.ts. A user who opens
 * the builder later should find the words they saw here.
 */
export function ScriptAutomation({ active, reducedMotion }: PreviewScriptProps) {
  const beat = usePreviewScript({ beats: BEATS, active, reducedMotion })
  const show = (from: number) => beat >= from

  return (
    <PreviewFrame activeNav="automations" navClicked={show(1)}>
      <div className="h-full flex flex-col items-center justify-center gap-1">
        {show(2) && (
          <div
            className={`w-40 rounded-lg border bg-card px-2.5 py-2 flex items-center gap-2 transition-colors duration-300 ${
              show(3) ? 'border-brand' : 'border-dashed border-border'
            }`}
          >
            <Zap size={12} strokeWidth={1.5} className="text-text-subtle shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] text-text-subtle">When</p>
              <p className="text-[11px] font-medium text-text truncate">
                {show(3) ? 'New enquiry' : 'Choose a trigger'}
              </p>
            </div>
          </div>
        )}

        {show(2) && (
          <div
            className={`w-px bg-border transition-all duration-500 ${show(4) ? 'h-6' : 'h-0'}`}
            aria-hidden
          />
        )}

        {show(4) && (
          <div
            className={`w-40 rounded-lg border bg-card px-2.5 py-2 flex items-center gap-2 animate-fade-in transition-colors duration-300 ${
              show(5) ? 'border-brand' : 'border-dashed border-border'
            }`}
          >
            <Mail size={12} strokeWidth={1.5} className="text-text-subtle shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] text-text-subtle">Then</p>
              <p className="text-[11px] font-medium text-text truncate">
                {show(5) ? 'Send email' : 'Add action'}
              </p>
            </div>
          </div>
        )}

        {show(6) && (
          <div className="flex items-center gap-1.5 pt-3 animate-fade-in">
            <span className="h-3.5 w-6 rounded-full bg-brand flex items-center justify-end px-0.5">
              <span className="h-2.5 w-2.5 rounded-full bg-card" />
            </span>
            <span className="text-[10px] text-text-muted">Live</span>
          </div>
        )}
      </div>
    </PreviewFrame>
  )
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run --project unit tests/unit/onboarding/script-automation.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Verify the resemblance against the real screen**

Open a real automation in the builder beside step 7. The canvas is the least literal of the four mocks, so the question is whether the trigger-then-action stack reads as the same idea, not whether the pixels line up. Confirm the labels match the real pickers word for word. This is the preview most at risk on a narrow phone: check Pixel 5 and simplify further if the cards crowd.

- [ ] **Step 6: Run the full unit suite and the gates**

Run: `npm run test:unit`
Expected: PASS, all suites.

Run: `npm run typecheck && npm run typecheck:strict && npm run lint:gate`
Expected: typecheck 0 errors; strict and lint within their budgets. If this work reduced either budget, ratchet the numbers down in the gate scripts.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/onboarding/previews/script-automation.tsx" tests/unit/onboarding/script-automation.test.tsx
git commit -m "feat(onboarding): automation preview"
```

---

### Task 13: End-to-end tests

**Files:**
- Create: `tests/e2e/welcome-onboarding.spec.ts`

**Interfaces:**
- Consumes: the `login` helper from `tests/e2e/helpers`, following `tests/e2e/branding-onboarding.spec.ts`.

- [ ] **Step 1: Write the spec**

Create `tests/e2e/welcome-onboarding.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'

import { login } from './helpers'

/**
 * Clears the welcome flag so the wizard opens again. Mirrors what a fresh
 * signup looks like without creating a new user per run.
 */
async function resetWelcomeState(page: Page) {
  await page.evaluate(() => localStorage.removeItem('zebri:welcome-onboarded'))
  await page.evaluate(async () => {
    const w = window as unknown as { __resetWelcome?: () => Promise<void> }
    await w.__resetWelcome?.()
  })
}

test.describe('Welcome onboarding', () => {
  test('a fresh user walks all eight steps', async ({ page }) => {
    await login(page)
    await resetWelcomeState(page)
    await page.goto('/')

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await expect(dialog.getByRole('heading', { name: /welcome to zebri/i })).toBeVisible()

    await dialog.getByRole('button', { name: /next/i }).click()
    await expect(dialog.getByLabel('Your name')).toBeVisible()
    await dialog.getByLabel('Phone').fill('+61 400 111 222')

    await dialog.getByRole('button', { name: /next/i }).click()
    await expect(dialog.getByLabel('Website')).toBeVisible()
    await dialog.getByLabel('Website').fill('https://example.com')

    // Steps 4 to 7 are previews: advance through each.
    for (const heading of [/add a couple/i, /create a template/i, /send it/i, /let it run/i]) {
      await dialog.getByRole('button', { name: /next/i }).click()
      await expect(dialog.getByRole('heading', { name: heading })).toBeVisible()
    }

    await dialog.getByRole('button', { name: /next/i }).click()
    await expect(dialog.getByRole('heading', { name: /a note from the founder/i })).toBeVisible()

    await dialog.getByRole('button', { name: /finish/i }).click()
    await expect(dialog).not.toBeVisible()
  })

  test('dismissing at a preview keeps the details and does not reopen', async ({ page }) => {
    await login(page)
    await resetWelcomeState(page)
    await page.goto('/')

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    await dialog.getByRole('button', { name: /next/i }).click()
    await dialog.getByLabel('Phone').fill('+61 400 999 888')
    await dialog.getByRole('button', { name: /next/i }).click()
    await dialog.getByRole('button', { name: /next/i }).click()  // saves, lands on step 4
    await expect(dialog.getByRole('heading', { name: /add a couple/i })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()

    await page.reload()
    await expect(page.getByRole('dialog')).not.toBeVisible()

    // The phone entered before the drop-out survived.
    await page.goto('/settings')
    await expect(page.getByLabel('Phone')).toHaveValue('+61 400 999 888')
  })
})
```

- [ ] **Step 2: Provide the reset hook**

The `resetWelcomeState` stub above uses a `window.__resetWelcome` hook that does not exist. Replace it with the same approach `branding-onboarding.spec.ts:21` takes: reset server-side, guarded to the isolated local server, and a no-op everywhere else.

That helper clears a `user_branding` row through PostgREST. Ours has to clear a key inside `auth.users.raw_user_meta_data`, which PostgREST cannot reach, so use the Supabase admin users API instead. Replace the stub in `tests/e2e/welcome-onboarding.spec.ts` with:

```ts
const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const FRESH_USER_EMAIL = 'test-fresh@zebri.com.au'

/**
 * Clears `welcome_onboarded_at` so the wizard opens again.
 *
 * Guarded to the isolated local server on port 3123, matching
 * resetFreshUserState in branding-onboarding.spec.ts. Against any other
 * target this is a no-op, because it would otherwise mutate a real user.
 */
async function resetWelcomeState(page: Page) {
  await page.evaluate(() => localStorage.removeItem('zebri:welcome-onboarded'))

  const isLocalServer = process.env.PLAYWRIGHT_BASE_URL?.includes('3123')
  if (!isLocalServer) return

  const key = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY
  if (!key) return
  const headers = { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' }

  try {
    const listRes = await fetch(
      `${LOCAL_SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(FRESH_USER_EMAIL)}`,
      { headers },
    )
    if (!listRes.ok) return
    const { users } = await listRes.json()
    const user = users?.[0]
    if (!user) return

    const { welcome_onboarded_at: _cleared, ...rest } = user.user_metadata ?? {}
    await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ user_metadata: rest }),
    })
  } catch {
    // A reset failure should not fail the suite on a non-local target.
  }
}
```

Read the service-role key from the environment rather than inlining it. `branding-onboarding.spec.ts:29` hardcodes a local key, but `scripts/check-no-service-role-in-client.mjs` exists precisely because that habit is dangerous, and a test file is not a good place to spread it.

Add `LOCAL_SUPABASE_SERVICE_ROLE_KEY` to the local test env (the value `supabase start` prints as `service_role key`). If the variable is absent the reset no-ops, so the suite still runs against a remote target without touching real data.

- [ ] **Step 3: Run the e2e suite**

Run: `npx playwright test tests/e2e/welcome-onboarding.spec.ts`
Expected: PASS on desktop, Pixel 5 and iPhone 12.

If a test fails, fix the app, not the test. A failure here is a bug in the wizard.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/welcome-onboarding.spec.ts tests/e2e/helpers
git commit -m "test(onboarding): e2e coverage for the welcome wizard"
```

---

### Task 14: Documentation and ship check

**Files:**
- Modify: `.claude/docs/page-specs.md`, `.claude/docs/component-library.md`, `.claude/docs/testing.md`

- [ ] **Step 1: Update page-specs.md**

Add a Welcome onboarding entry: the eight steps, the soft gate on `user_metadata.welcome_onboarded_at`, the save-on-step-3 behaviour, and the fact that it is shown once with no re-entry point.

- [ ] **Step 2: Update component-library.md**

Document `AddressAutocomplete` (now a shared primitive, with its props) and the onboarding preview components (`PreviewFrame`, the `PreviewScriptProps` contract, `usePreviewScript`). Note that previews are hand-built mocks held to a resemblance bar by review, not by any mechanism.

- [ ] **Step 3: Update testing.md**

Add the new selectors: the wizard dialog, the step headings, and the `data-active` attribute on preview nav items.

- [ ] **Step 4: Run the full pyramid**

Run: `npm test && npm run typecheck && npm run typecheck:strict && npm run lint:gate`
Expected: all green, budgets not increased.

Run: `npx playwright test`
Expected: PASS.

- [ ] **Step 5: Confirm the founder copy decision**

Step 8 ships with placeholder body text. Before opening the PR, either replace it with real copy or put the step behind a flag. Do not merge placeholder copy to a branch bound for production without raising it explicitly in the PR description.

- [ ] **Step 6: Commit and open the PR**

```bash
git add .claude/docs/
git commit -m "docs(onboarding): welcome wizard specs, components and selectors"
```

Open the PR against `staging`, per the current staging-only batch convention.

---

## Open items carried from the spec

1. **Step 8 placeholder copy.** Task 14 Step 5 gates this. It is the one thing in the plan that cannot be resolved by an implementer alone.
2. **Preview drift.** Nothing detects it. When a real screen changes materially, the matching preview needs a look. Task 14 Step 2 records this in the component docs so the next person knows.
3. **`bg-brand-soft` token.** Task 10 uses it for the variable chip. If it does not exist in the token table, substitute the nearest documented one rather than adding an arbitrary colour.
