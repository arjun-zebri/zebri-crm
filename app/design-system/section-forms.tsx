'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { CodeBlock, Example, Rule, Section, Spec } from './showroom';

/**
 * Forms: how fields are laid out, labelled, validated and submitted.
 *
 * The primitives are documented individually under Form controls; this
 * section is about assembling them.
 *
 * @module app/design-system/section-forms
 */

const STATUS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'booked', label: 'Booked' },
];

/** Form layout, validation and submission patterns. */
export function SectionForms() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('not-an-email');
  const [status, setStatus] = useState('new');
  const [date, setDate] = useState('');
  const [bcc, setBcc] = useState(false);
  const [saving, setSaving] = useState(false);

  return (
    <Section
      id="forms"
      title="Forms"
      description="How to assemble fields into a form. The individual controls are documented under Form controls."
    >
      <Spec name="Field anatomy" description="Every field is label, control, then help or error. Never placeholder-as-label.">
        <Rule>
          A visible <code>label</code> is required. Placeholders are examples of the expected
          value, not a substitute for a label: they vanish the moment the user types, and screen
          readers do not reliably announce them.
        </Rule>
        <Example
          code={`<Input\n  label="Email"\n  type="email"\n  value={email}\n  onChange={(e) => setEmail(e.target.value)}\n  help="We send the invoice copy here."\n/>`}
        >
          <div className="max-w-sm">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              help="We send the invoice copy here."
            />
          </div>
        </Example>
      </Spec>

      <Spec name="Validation" description="Error replaces help text and is announced.">
        <Rule>
          Pass <code>error</code> rather than styling the field yourself. The primitive sets{' '}
          <code>aria-invalid</code>, wires <code>aria-describedby</code>, and gives the message{' '}
          <code>role=&quot;alert&quot;</code> so it is read out when it appears.
        </Rule>
        <Example
          code={`<Input\n  label="Email"\n  error="That email is not valid."\n  value={email}\n  onChange={…}\n/>`}
        >
          <div className="max-w-sm">
            <Input
              label="Email"
              // Spread rather than `error={… : undefined}`: under
              // exactOptionalPropertyTypes an explicit `undefined` is not
              // the same as an absent prop.
              {...(email.includes('@') ? {} : { error: 'That email is not valid.' })}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </Example>
      </Spec>

      <Spec name="Field layout" description="One column by default. Two only for genuinely paired values.">
        <Rule>
          Stack fields in a single column with <code>space-y-3</code>. Side-by-side fields make a
          form harder to scan and break on mobile. The exception is a pair that reads as one value,
          like a date range.
        </Rule>
        <Example
          code={`<div className="space-y-3">\n  <Input label="Couple name" … />\n  <Select label="Status" options={…} … />\n  <DatePicker … />\n</div>`}
        >
          <Card className="max-w-sm">
            <div className="space-y-3">
              <Input
                label="Couple name"
                placeholder="Alex and Sam"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Select label="Status" options={STATUS} value={status} onValueChange={setStatus} />
              <div className="space-y-1">
                <span className="block text-body font-medium text-text">Event date</span>
                <DatePicker value={date} onChange={setDate} placeholder="Pick a date" />
              </div>
              <Checkbox checked={bcc} onChange={setBcc} label="BCC yourself" />
            </div>
          </Card>
        </Example>
      </Spec>

      <Spec name="Form actions" description="Right-aligned, primary last, cancel as outline.">
        <Rule>
          The confirming action is <code>variant=&quot;primary&quot;</code> and sits last, so it is
          nearest the thumb on mobile and last in the tab order. Cancel is{' '}
          <code>variant=&quot;outline&quot;</code>. Use <code>loading</code> on submit rather than
          disabling and swapping the label yourself: it keeps the width stable and sets{' '}
          <code>aria-busy</code>.
        </Rule>
        <Example
          code={`<div className="flex justify-end gap-2">\n  <Button variant="outline" onClick={onCancel}>Cancel</Button>\n  <Button loading={saving} onClick={onSave}>Save changes</Button>\n</div>`}
        >
          <div className="flex justify-end gap-2">
            <Button variant="outline">Cancel</Button>
            <Button
              loading={saving}
              onClick={() => {
                setSaving(true);
                setTimeout(() => setSaving(false), 1200);
              }}
            >
              Save changes
            </Button>
          </div>
        </Example>
      </Spec>

      <Spec name="Destructive actions" description="Confirm before anything irreversible.">
        <Rule>
          Never delete on a single click. Raise a <code>ConfirmDialog</code>, name the object in the
          title, and spell out what is lost in the description. The confirm button is{' '}
          <code>variant=&quot;danger&quot;</code>; the dialog supplies it for you.
        </Rule>
        <CodeBlock code={`const [confirming, setConfirming] = useState(false)\n\n<Button variant="danger" onClick={() => setConfirming(true)}>Delete</Button>\n\n<ConfirmDialog\n  open={confirming}\n  title="Delete this couple?"\n  description="This removes the couple, their events and their tasks. It cannot be undone."\n  onConfirm={remove}\n  onCancel={() => setConfirming(false)}\n  loading={deleting}\n/>`} />
      </Spec>
    </Section>
  );
}
