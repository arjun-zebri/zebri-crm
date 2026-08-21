'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton, SkeletonRegion, SkeletonText } from '@/components/ui/skeleton';

import { CodeBlock, Demo, DemoGrid, DemoRow, Example, Rule, Spec } from './showroom';

/**
 * Surface foundations: elevation, spacing, motion and iconography.
 *
 * @module app/design-system/foundations-surface
 */

const SHADOWS = [
  { cls: 'shadow-sm', use: 'Resting cards and panels. The default.' },
  { cls: 'shadow-md', use: 'Rarely needed. Prefer sm or lg.' },
  { cls: 'shadow-lg', use: 'Dropdowns, popovers, menus.' },
  { cls: 'shadow-xl', use: 'Modals and dialogs.' },
  { cls: 'shadow-2xl', use: 'Side panels only.' },
];

const SPACING = [
  { cls: 'p-4', px: '16px', use: 'Compact cards, dense panels' },
  { cls: 'p-6', px: '24px', use: 'Standard card and panel padding' },
  { cls: 'p-8', px: '32px', use: 'Page-level panels, auth forms' },
];

const GAPS = [
  { cls: 'gap-1.5', px: '6px', use: 'Icon to label inside a control' },
  { cls: 'gap-2', px: '8px', use: 'Between related controls' },
  { cls: 'gap-3', px: '12px', use: 'Between form fields' },
  { cls: 'gap-6', px: '24px', use: 'Between cards in a grid' },
];

/** Filler options for the control-height row; content is irrelevant. */
const CONTROL_ROW_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'booked', label: 'Booked' },
];

/** Entrances. Each plays once when the element mounts. */
const ENTRANCES = [
  { cls: 'animate-fade-in', spec: '150ms ease-out', use: 'Backdrops, popovers appearing' },
  { cls: 'animate-modal-in', spec: '200ms ease-out', use: 'Modal and dialog panels' },
  { cls: 'animate-slide-in-right', spec: '250ms ease-out', use: 'Side panels' },
];

/** Elevation, spacing, motion and icon rules. */
export function FoundationsSurface() {
  const [replay, setReplay] = useState(0);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <Spec name="Elevation" file="app/globals.css" description="Shadow rises with how far the surface floats above the page.">
        <Rule>
          Elevation signals distance, not importance. A resting card never needs more than{' '}
          <code>shadow-sm</code>. If a surface floats over content it takes <code>shadow-lg</code>{' '}
          or higher.
        </Rule>
        <DemoGrid cols={3}>
          {SHADOWS.map((s) => (
            <Demo key={s.cls} label={s.cls}>
              <div className={`h-16 rounded-control border border-border bg-surface ${s.cls}`} />
              <p className="mt-2 text-body text-text-subtle">{s.use}</p>
            </Demo>
          ))}
        </DemoGrid>
      </Spec>

      <Spec name="Spacing" description="Padding inside surfaces, and the gaps between things.">
        <Example label="Container padding" code={`<Card padding="sm">  {/* p-4 */}\n<Card padding="md">  {/* p-6, default */}\n<Card padding="lg">  {/* p-8 */}`}>
          <DemoRow>
            {SPACING.map((s) => (
              <div key={s.cls} className={`rounded-control border border-border bg-surface ${s.cls}`}>
                <div className="h-6 w-16 rounded-control bg-surface-emphasis" />
                <code className="mt-1 block text-center text-body text-text-subtle">
                  {s.cls} · {s.px}
                </code>
              </div>
            ))}
          </DemoRow>
        </Example>

        <Demo label="Gaps">
          <div className="space-y-2">
            {GAPS.map((g) => (
              <div key={g.cls} className="flex items-center gap-4">
                <div className={`flex ${g.cls}`}>
                  <span className="h-5 w-8 rounded-control bg-surface-emphasis" />
                  <span className="h-5 w-8 rounded-control bg-surface-emphasis" />
                  <span className="h-5 w-8 rounded-control bg-surface-emphasis" />
                </div>
                <code className="text-body text-text-subtle">
                  {g.cls} · {g.px} · {g.use}
                </code>
              </div>
            ))}
          </div>
        </Demo>
      </Spec>

      <Spec name="Motion" file="app/globals.css" description="Entrances. Each plays once, on mount.">
        <Rule>
          Motion confirms a change, it does not decorate. Entrances only; nothing loops except
          loading indicators. Durations stay under 250ms so the UI never feels like it is waiting
          on itself.
        </Rule>
        <div className="space-y-3">
          <DemoRow>
            <Button variant="outline" onClick={() => setReplay((n) => n + 1)}>
              Replay
            </Button>
            <span className="text-body text-text-subtle">
              Re-mounts the specimens below so the entrances run again.
            </span>
          </DemoRow>
          <DemoGrid cols={3}>
            {ENTRANCES.map((m) => (
              <Demo key={m.cls} label={m.cls}>
                <div
                  key={`${m.cls}-${replay}`}
                  className={`flex h-16 items-center justify-center rounded-control border border-border bg-surface text-body text-text-subtle ${m.cls}`}
                >
                  {m.spec}
                </div>
                <p className="mt-2 text-body text-text-subtle">{m.use}</p>
              </Demo>
            ))}
          </DemoGrid>
        </div>
      </Spec>

      <Spec name="Loading" description="Two loading states, and which one to use is not a judgement call.">
        <Rule>
          <strong>A spinner only ever lives inside a button.</strong> An in-flight action uses{' '}
          <code>&lt;Button loading&gt;</code>, which swaps the spinner in for you, disables the
          control and sets <code>aria-busy</code>. Never place a bare spinner on the page.
          <br />
          <strong>A busy button never changes size.</strong> The spinner is laid <em>over</em> the
          label, not added beside it, and the label itself must not change. Writing{' '}
          <code>{'{'}saving ? &apos;Saving…&apos; : &apos;Save&apos;{'}'}</code> resizes the
          control mid-click and shoves everything beside it sideways &mdash; pass{' '}
          <code>loading</code> and leave the label alone. Buttons that cannot be a{' '}
          <code>Button</code> (the public branded surfaces) use <code>BusyLabel</code> for the
          same effect.
          <br />
          <strong>A whole surface waiting on data always uses a skeleton.</strong> Mirror the shape
          of the content that is coming, so the layout does not jump when it arrives. A centred
          spinner tells the user nothing about what they are waiting for and reflows the page when
          it resolves.
          <br />
          <strong>Build it from <code>Skeleton</code>, not by hand.</strong> The primitive owns the
          surface token, the radius and the pulse. Wrap a group in{' '}
          <code>SkeletonRegion</code> so the wait is announced once in words: the shapes themselves
          are hidden from screen readers, which gain nothing from a list of empty boxes.
          <br />
          <strong>On a branded surface, pass <code>tone=&quot;inherit&quot;</code>.</strong> The
          public pages carry the MC&apos;s own palette, and the default grey either vanishes into a
          dark background or fights a light one. <code>inherit</code> tints from the page&apos;s
          text colour instead, so one skeleton works for every brand.
        </Rule>
        <Example
          label="In-flight action"
          code={`<Button loading={saving} onClick={save}>Save changes</Button>`}
        >
          <DemoRow>
            <Button
              loading={saving}
              onClick={() => {
                setSaving(true);
                setTimeout(() => setSaving(false), 2000);
              }}
            >
              Save changes
            </Button>
            <Button variant="danger" loading>
              Deleting
            </Button>
            <Button variant="outline" loading>
              Loading
            </Button>
            <span className="text-body text-text-subtle">
              Click Save to watch the spinner replace the label.
            </span>
          </DemoRow>
        </Example>

        <Example
          label="Whole surface waiting: skeleton, shaped like the content"
          code={`<SkeletonRegion label="Loading couples" className="space-y-3">\n  {Array.from({ length: 4 }).map((_, i) => (\n    <div key={i} className="flex items-center justify-between">\n      <div className="space-y-1.5">\n        <Skeleton className="h-4 w-48" />\n        <Skeleton className="h-4 w-24" />\n      </div>\n      <Skeleton shape="pill" className="h-6 w-16" />\n    </div>\n  ))}\n</SkeletonRegion>`}
        >
          <Card>
            <SkeletonRegion label="Loading couples" className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton shape="pill" className="h-6 w-16" />
                </div>
              ))}
            </SkeletonRegion>
          </Card>
        </Example>

        <Example
          label="Paragraph placeholder"
          code={`<SkeletonText lines={3} />`}
        >
          <Card>
            <SkeletonText lines={3} />
          </Card>
        </Example>

        <Example
          label="Branded surface: tone=&quot;inherit&quot; tints from the page colour"
          code={`<SkeletonRegion label="Loading booking page">\n  <Skeleton tone="inherit" className="h-5 w-36" />\n  <SkeletonText tone="inherit" lines={2} />\n</SkeletonRegion>`}
        >
          <div className="rounded-control p-6 bg-text text-text-inverse">
            <SkeletonRegion label="Loading booking page" className="space-y-3">
              <Skeleton tone="inherit" className="h-5 w-36" />
              <SkeletonText tone="inherit" lines={2} />
            </SkeletonRegion>
          </div>
        </Example>

        <Example
          label="Superseded: the same thing written by hand"
          code={`{isLoading ? (\n  <Card>\n    <div className="animate-pulse space-y-3">\n      {Array.from({ length: 4 }).map((_, i) => (\n        <div key={i} className="flex items-center justify-between">\n          <div className="space-y-1.5">\n            <div className="h-4 w-48 rounded-control bg-surface-emphasis" />\n            <div className="h-4 w-24 rounded-control bg-surface-emphasis" />\n          </div>\n          <div className="h-4 w-16 rounded-control bg-surface-emphasis" />\n        </div>\n      ))}\n    </div>\n  </Card>\n) : (\n  <CoupleList couples={couples} />\n)}`}
        >
          <Card>
            <div className="animate-pulse space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <div className="h-4 w-48 rounded-control bg-surface-emphasis" />
                    <div className="h-4 w-24 rounded-control bg-surface-emphasis" />
                  </div>
                  <div className="h-4 w-16 rounded-control bg-surface-emphasis" />
                </div>
              ))}
            </div>
          </Card>
        </Example>
      </Spec>

      <Spec name="Icons" description="Lucide, at one weight.">
        <Rule>
          Every icon is Lucide with <code>strokeWidth={'{1.5}'}</code>. Size by context: 11 to 12px
          inside a compact control, 14 to 16px in a standard control, 18px standalone. Icons are
          decorative unless they are the only content, in which case the control needs an{' '}
          <code>aria-label</code>.
        </Rule>
        <CodeBlock code={`import { Plus } from 'lucide-react'\n\n<Plus size={14} strokeWidth={1.5} />\n\n{/* icon-only control */}\n<Button iconOnly aria-label="Add couple">\n  <Plus size={14} strokeWidth={1.5} />\n</Button>`} />
        <DemoRow>
          {[11, 12, 14, 16, 18].map((n) => (
            <div key={n} className="space-y-1 text-center">
              <svg
                width={n}
                height={n}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto text-text"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <code className="block text-body text-text-subtle">{n}px</code>
            </div>
          ))}
        </DemoRow>
      </Spec>

      <Spec
        name="State changes never resize"
        file="components/ui/busy-label.tsx"
        description="Loading, copied, confirming: the control keeps its box."
      >
        <Rule>
          A control that changes size when you click it moves everything around it. Two primitives
          cover the cases: <code>BusyLabel</code> (used by <code>Button loading</code>) overlays a
          spinner on the label, and <code>CopyButton</code> stacks its idle and confirmed labels in
          one grid cell so the button is always as wide as the longer one. For anything else,
          reserve the space rather than swapping the text.
        </Rule>
        <Example
          label="Busy: the label holds its box, the spinner sits on top"
          code={`{/* inside a Button */}\n<Button loading={saving}>Save changes</Button>\n\n{/* a branded surface that cannot be a Button */}\n<button disabled={saving} aria-busy={saving || undefined} style={brand}>\n  <BusyLabel busy={saving}>Save changes</BusyLabel>\n</button>`}
        >
          <DemoRow>
            <Button onClick={() => setBusy((b) => !b)} variant="outline">
              Toggle
            </Button>
            <Button loading={busy}>Save changes</Button>
            <Button variant="danger" loading={busy}>
              Delete
            </Button>
            <span className="text-body text-text-subtle">
              Toggle and watch: neither button moves.
            </span>
          </DemoRow>
        </Example>
        <Example
          label="Copied: both labels share a cell, so the wider one sets the width"
          code={`<CopyButton value={shareUrl} label="Copy link" />\n\n{/* meta rows that read as a sentence */}\n<CopyButton plain value={shareUrl} label="Copy link" />`}
        >
          <DemoRow>
            <CopyButton value="https://zebri.app/example" label="Copy link" />
            <CopyButton value="https://zebri.app/example" label="Copy" />
            <span className="text-body text-text-subtle">·</span>
            <CopyButton plain value="https://zebri.app/example" label="Copy link" />
          </DemoRow>
        </Example>
      </Spec>

      <Spec
        name="Control height"
        file="components/ui/button.tsx"
        description="One height for every control, so rows line up with no effort."
      >
        <Rule>
          Every control is <strong>32px</strong> (<code>h-8</code>). <code>Button</code>,{' '}
          <code>Input</code>, <code>Select</code> and <code>DatePicker</code> have no{' '}
          <code>size</code> prop. Never hand-set <code>h-9</code>, <code>h-10</code> or{' '}
          <code>py-2</code> on a control to make it &quot;match&quot; another one; if two controls
          disagree, one of them is not using the primitive.
        </Rule>
        <Demo label="Button, Input, Select and DatePicker in one row">
          <DemoRow>
            <Button>Save</Button>
            <Button variant="outline">Cancel</Button>
            <div className="w-40">
              <Input placeholder="Search" />
            </div>
            <div className="w-40">
              <Select placeholder="Status" options={CONTROL_ROW_OPTIONS} />
            </div>
            <div className="w-44">
              <DatePicker value="" onChange={() => {}} placeholder="Pick a date" />
            </div>
          </DemoRow>
        </Demo>
      </Spec>

      <Spec name="Cursor" file="app/globals.css" description="Who owns the hand cursor.">
        <Rule>
          <code>globals.css</code> sets <code>cursor: pointer</code> on every non-disabled{' '}
          <code>button</code> and <code>[role=&quot;button&quot;]</code>, in{' '}
          <code>@layer base</code>. So do <strong>not</strong> add <code>cursor-pointer</code> to a{' '}
          <code>&lt;button&gt;</code> or to <code>Button</code>. Do add it to non-button
          clickables: table rows, cards, and anything whose click handler sits on a{' '}
          <code>div</code>.
        </Rule>
        <CodeBlock
          code={`/* globals.css — already done, do not repeat per call site */\n@layer base {\n  button:not(:disabled):not([aria-disabled='true']),\n  [role='button']:not(:disabled):not([aria-disabled='true']) {\n    cursor: pointer;\n  }\n}\n\n{/* still needed: the click target is not a button */}\n<tr onClick={open} className="cursor-pointer hover:bg-surface-muted">`}
        />
      </Spec>
    </>
  );
}
