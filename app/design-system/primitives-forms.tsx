'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { Conflict } from './conflict';
import { Demo, DemoGrid, DemoRow, Spec } from './showroom';

/**
 * Form primitives: Button, Input, Select, Checkbox, DatePicker.
 *
 * Every variant and size is rendered, so a missing or off-pattern
 * combination is visible rather than inferred from the type signature.
 *
 * @module app/design-system/primitives-forms
 */

const VARIANTS = ['primary', 'secondary', 'outline', 'ghost', 'danger', 'success'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'booked', label: 'Booked' },
  { value: 'complete', label: 'Complete' },
];

/** All form-control primitives with their variant matrices. */
export function PrimitivesForms() {
  const [checked, setChecked] = useState(true);
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('new');

  return (
    <>
      <Spec name="Button" file="components/ui/button.tsx" description="Six variants, three sizes, plus loading and disabled states.">
        <div className="space-y-6">
          <Demo label="Variants (size md)">
            <DemoRow>
              {VARIANTS.map((v) => (
                <Button key={v} variant={v}>
                  {v}
                </Button>
              ))}
            </DemoRow>
          </Demo>
          <Demo label="Sizes">
            <DemoRow>
              {SIZES.map((s) => (
                <Button key={s} size={s}>
                  Size {s}
                </Button>
              ))}
            </DemoRow>
          </Demo>
          <Demo label="States">
            <DemoRow>
              <Button loading>Loading</Button>
              <Button disabled>Disabled</Button>
              <Button variant="danger" loading>
                Deleting
              </Button>
            </DemoRow>
          </Demo>
        </div>
      </Spec>

      <Conflict
        title="CLAUDE.md says buttons are rounded-xl. The Button primitive is rounded-control (6px)."
        group="controls"
        recommendation={
          <>
            The primitive is right and the rule is stale: 6px matches the Input and Select triggers,
            and a 12px button next to a 6px input looks mismatched. Fix the CLAUDE.md line rather
            than the component. The 663 native <code>&lt;button&gt;</code> elements are the real
            problem, since each carries its own hand-written radius.
          </>
        }
      >
        <DemoRow>
          <div className="space-y-1 text-center">
            <Button>Button primitive</Button>
            <code className="block text-caption text-text-subtle">rounded-control · 6px</code>
          </div>
          <div className="space-y-1 text-center">
            <button
              type="button"
              className="inline-flex h-9 cursor-pointer items-center rounded-xl bg-brand-fg px-4 text-body font-medium text-text-inverse"
            >
              Per CLAUDE.md
            </button>
            <code className="block text-caption text-text-subtle">rounded-xl · 12px</code>
          </div>
          <div className="space-y-1 text-center">
            <button
              type="button"
              className="inline-flex h-9 cursor-pointer items-center rounded-full bg-brand-fg px-4 text-body font-medium text-text-inverse"
            >
              Found in app
            </button>
            <code className="block text-caption text-text-subtle">rounded-full · banned</code>
          </div>
        </DemoRow>
      </Conflict>

      <Spec name="Input" file="components/ui/input.tsx" description="Two sizes. Label, help text and error are wired with aria-describedby.">
        <DemoGrid cols={3}>
          <Demo label="Default (md)">
            <Input label="Couple name" placeholder="Alex and Sam" />
          </Demo>
          <Demo label="Small">
            <Input size="sm" label="Couple name" placeholder="Alex and Sam" />
          </Demo>
          <Demo label="With help text">
            <Input label="Email" type="email" help="We send the quote copy here." />
          </Demo>
          <Demo label="Error">
            <Input label="Email" error="That email is not valid." defaultValue="not-an-email" />
          </Demo>
          <Demo label="Disabled">
            <Input label="Reference" disabled defaultValue="ZEB-0041" />
          </Demo>
          <Demo label="Read only">
            <Input label="Reference" readOnly defaultValue="ZEB-0041" />
          </Demo>
        </DemoGrid>
      </Spec>

      <Conflict
        title="119 native inputs bypass the Input primitive"
        recommendation={
          <>
            The primitive gives a label, help slot, error slot and correct{' '}
            <code>aria-describedby</code> linkage. Native inputs in the app have none of that, so
            each one is an accessibility gap as well as a styling gap. Compare the focus ring and
            label spacing below.
          </>
        }
      >
        <DemoGrid cols={2}>
          <Demo label="Input primitive">
            <Input label="Venue" placeholder="Click to focus" />
          </Demo>
          <Demo label="Native input as found in the app">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-900">Venue</label>
              <input
                placeholder="Click to focus"
                className="block h-9 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-gray-900 focus:outline-none"
              />
            </div>
          </Demo>
        </DemoGrid>
      </Conflict>

      <Spec name="Select" file="components/ui/select.tsx" description="Radix-backed. Trigger size drives the dropdown item size.">
        <DemoGrid cols={3}>
          <Demo label="Default (md)">
            <Select label="Status" options={STATUS_OPTIONS} value={status} onValueChange={setStatus} />
          </Demo>
          <Demo label="Small">
            <Select size="sm" label="Status" options={STATUS_OPTIONS} value={status} onValueChange={setStatus} />
          </Demo>
          <Demo label="Placeholder">
            <Select label="Status" options={STATUS_OPTIONS} placeholder="Choose one" />
          </Demo>
          <Demo label="Error">
            <Select label="Status" options={STATUS_OPTIONS} error="Pick a status." />
          </Demo>
          <Demo label="Disabled">
            <Select label="Status" options={STATUS_OPTIONS} disabled placeholder="Unavailable" />
          </Demo>
          <Demo label="Disabled option">
            <Select
              label="Status"
              placeholder="Choose one"
              options={[...STATUS_OPTIONS, { value: 'archived', label: 'Archived', disabled: true }]}
            />
          </Demo>
        </DemoGrid>
      </Spec>

      <Spec name="Checkbox" file="components/ui/checkbox.tsx" description="A button with role=checkbox, not a native input, so it can carry tokens.">
        <DemoRow>
          <Checkbox checked={checked} onChange={setChecked} label="BCC yourself" />
          <Checkbox checked={false} onChange={() => {}} label="Unchecked" />
          <Checkbox checked disabled onChange={() => {}} label="Disabled checked" />
          <Checkbox checked={false} disabled onChange={() => {}} label="Disabled" />
          <Checkbox checked onChange={() => {}} color="#7c3aed" label="Branded colour" />
        </DemoRow>
      </Spec>

      <Conflict
        title="Checkbox is the only primitive still built on raw palette colours"
        recommendation={
          <>
            Its checked fill is <code>bg-emerald-500</code> and its borders are{' '}
            <code>gray-200</code> / <code>gray-300</code> / <code>gray-500</code>, while{' '}
            <code>StatePill</code> and <code>Button</code> use <code>bg-success</code> and{' '}
            <code>border-border</code>. Note the two greens below are genuinely different:
            emerald-500 is <code>#10b981</code>, the success token is <code>#059669</code>.
          </>
        }
      >
        <DemoRow>
          <div className="space-y-1 text-center">
            <span className="mx-auto flex h-4 w-4 items-center justify-center rounded border border-emerald-500 bg-emerald-500" />
            <code className="block text-caption text-text-subtle">emerald-500 · #10b981</code>
          </div>
          <div className="space-y-1 text-center">
            <span className="mx-auto flex h-4 w-4 items-center justify-center rounded-control border border-success bg-success" />
            <code className="block text-caption text-text-subtle">success token · #059669</code>
          </div>
        </DemoRow>
      </Conflict>

      <Spec name="DatePicker" file="components/ui/date-picker.tsx" description="Three trigger variants, two sizes, plus an inline calendar mode.">
        <DemoGrid cols={3}>
          <Demo label="outlined (default)">
            <DatePicker value={date} onChange={setDate} placeholder="Pick a date" />
          </Demo>
          <Demo label="underline">
            <DatePicker value={date} onChange={setDate} variant="underline" placeholder="Pick a date" />
          </Demo>
          <Demo label="meta">
            <DatePicker value={date} onChange={setDate} variant="meta" placeholder="Pick a date" />
          </Demo>
        </DemoGrid>
      </Spec>

      <Conflict
        title="DatePicker has three trigger variants; Input and Select have one"
        recommendation={
          <>
            <code>underline</code> and <code>meta</code> exist only on DatePicker, so a date field
            and a text field sitting in the same form can look like they belong to different apps.
            Either add the same variants to Input and Select, or retire the extra two and let
            context handle it.
          </>
        }
      >
        <DemoRow>
          <Input size="sm" placeholder="Text field" />
          <DatePicker value={date} onChange={setDate} size="sm" variant="underline" placeholder="Date field" />
        </DemoRow>
      </Conflict>
    </>
  );
}
