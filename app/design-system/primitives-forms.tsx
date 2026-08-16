'use client';

import { X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CopyButton } from '@/components/ui/copy-button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { Demo, DemoGrid, DemoRow, Rule, Spec } from './showroom';

/**
 * Form primitives: Button, Input, Textarea, Select, Checkbox,
 * DatePicker.
 *
 * Every variant and state is rendered, so a missing or off-pattern
 * combination is visible rather than inferred from the type signature.
 *
 * @module app/design-system/primitives-forms
 */

const VARIANTS = ['primary', 'secondary', 'outline', 'ghost', 'danger', 'success'] as const;

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
      <Spec name="Button" file="components/ui/button.tsx"
        importPath="@/components/ui/button" description="Six variants, one height, icon-only mode, plus loading and disabled states.">
        <Rule>
          There is no <code>size</code> prop. Every control in the app is 32px tall, so a button
          never disagrees with the input or select beside it. Four sizes existed until 2026-08-07
          and mismatched heights were the most common visual bug in the app. Nothing sets
          <code> cursor-pointer</code> either: a base rule in <code>globals.css</code> gives every{' '}
          <code>button</code> the hand cursor, including raw ones this primitive does not own.
        </Rule>
        <div className="space-y-6">
          <Demo label="Variants">
            <DemoRow>
              {VARIANTS.map((v) => (
                <Button key={v} variant={v}>
                  {v}
                </Button>
              ))}
            </DemoRow>
          </Demo>
          <Demo label="Icon-only (square, width locked to height)">
            <DemoRow>
              {VARIANTS.map((v) => (
                <Button key={v} variant={v} iconOnly aria-label={`Close ${v}`}>
                  <X width={14} height={14} strokeWidth={1.5} aria-hidden="true" />
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

      <Spec name="Input" file="components/ui/input.tsx"
        importPath="@/components/ui/input" description="One height. Label, help text and error are wired with aria-describedby.">
        <DemoGrid cols={3}>
          <Demo label="Default">
            <Input label="Couple name" placeholder="Alex and Sam" />
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

      <Spec name="Textarea" file="components/ui/textarea.tsx"
        importPath="@/components/ui/textarea" description="Input's sibling for prose. Same chrome; height comes from rows, and it resizes vertically only.">
        <DemoGrid cols={3}>
          <Demo label="Default">
            <Textarea label="Note" placeholder="Anything worth remembering" />
          </Demo>
          <Demo label="With help text">
            <Textarea label="Description" rows={3} help="Shown on the task when it lands." />
          </Demo>
          <Demo label="Error">
            <Textarea label="Message" error="A message is required." />
          </Demo>
          <Demo label="Fixed height">
            <Textarea label="Description" rows={3} resizable={false} />
          </Demo>
        </DemoGrid>
      </Spec>

      <Spec name="Select" file="components/ui/select.tsx"
        importPath="@/components/ui/select" description="Radix-backed. Same 32px trigger as Input and Button.">
        <Rule>
          The dropdown is portalled to <code>document.body</code>, so it does <em>not</em> inherit
          the trigger&apos;s type size. Any floating panel needs <code>text-body</code> on the panel
          itself, or its rows render at the document&apos;s 16px and read larger than the control
          that opened them.
        </Rule>
        <DemoGrid cols={3}>
          <Demo label="Default">
            <Select label="Status" options={STATUS_OPTIONS} value={status} onValueChange={setStatus} />
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

      <Spec name="CopyButton" file="components/ui/copy-button.tsx"
        importPath="@/components/ui/copy-button" description="Copy to clipboard, with a confirmed state that does not resize the button.">
        <Rule>
          Never hand-roll <code>{'{'}copied ? &apos;Copied!&apos; : &apos;Copy link&apos;{'}'}</code>{' '}
          &mdash; the label change resizes the control mid-click. This stacks both labels in one
          grid cell, so the button is always as wide as the longer one. It owns the clipboard
          write and the revert timer too. Pass a function as <code>value</code> when the string
          needs <code>window</code>. <code>plain</code> renders bare text for meta rows.
        </Rule>
        <DemoGrid cols={3}>
          <Demo label="Default">
            <CopyButton value="https://zebri.app/example" label="Copy link" />
          </Demo>
          <Demo label="Custom labels">
            <CopyButton value="ZEB-0041" label="Copy ref" copiedLabel="Copied ref" />
          </Demo>
          <Demo label="plain (meta rows)">
            <CopyButton plain value="https://zebri.app/example" label="Copy link" />
          </Demo>
        </DemoGrid>
      </Spec>

      <Spec name="Checkbox" file="components/ui/checkbox.tsx"
        importPath="@/components/ui/checkbox" description="A button with role=checkbox, not a native input, so it can carry tokens.">
        <DemoRow>
          <Checkbox checked={checked} onChange={setChecked} label="BCC yourself" />
          <Checkbox checked={false} onChange={() => {}} label="Unchecked" />
          <Checkbox checked disabled onChange={() => {}} label="Disabled checked" />
          <Checkbox checked={false} disabled onChange={() => {}} label="Disabled" />
          <Checkbox checked onChange={() => {}} color="#7c3aed" label="Branded colour" />
        </DemoRow>
      </Spec>

      <Spec name="DatePicker" file="components/ui/date-picker.tsx"
        importPath="@/components/ui/date-picker" description="One trigger, the Input geometry. Icon on either side, plus an inline calendar mode.">
        <Rule>
          There is no <code>variant</code> prop. A date field is a text field that opens a
          calendar, so it wears the <code>Input</code> chrome: 32px, control radius, border darkens
          on focus. The <code>underline</code> and <code>meta</code> treatments were removed on
          2026-08-07 &mdash; three chromes for one control meant a date field looked like a
          different species depending on which form it landed in.
        </Rule>
        <DemoGrid cols={3}>
          <Demo label="Default (icon right)">
            <DatePicker value={date} onChange={setDate} placeholder="Pick a date" />
          </Demo>
          <Demo label="Icon left">
            <DatePicker value={date} onChange={setDate} iconPosition="left" placeholder="Pick a date" />
          </Demo>
          <Demo label="With a display prefix">
            <DatePicker value={date} onChange={setDate} displayPrefix="Expires" placeholder="Set due date" />
          </Demo>
          <Demo label="Disabled">
            <DatePicker value={date} onChange={setDate} disabled placeholder="Pick a date" />
          </Demo>
        </DemoGrid>
      </Spec>

    </>
  );
}
