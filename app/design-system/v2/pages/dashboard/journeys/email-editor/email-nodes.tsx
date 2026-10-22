'use client';

import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { TrashIcon } from '@/components/ui-v2/icons';
import { InlineInput } from '@/components/ui-v2/inline-input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui-v2/popover';
import { Variable } from '@/lib/branding/rich-text-extensions';

import { AttachmentCard, EmailButtonFace, PackagesGrid } from '../../email/render/email-body';

/**
 * What a journey email is built from beyond text, each drawn in the
 * editor as it lands in the inbox: a field that fills in per client
 * (`VariableChip`), a button in the brand colour (its words and link set
 * in a popover while it is picked), the MC's packages, a link to a
 * document, and a spacer. Photos and video are in `email-media.tsx`. A
 * block is drawn with the very pieces `EmailBody` sends (`EmailButtonFace`,
 * `PackagesGrid`, `AttachmentCard`, `VideoFace`), so the
 * editor never drifts from what lands. A picked block shows the selected
 * outline and a delete inside it; Backspace deletes it too.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/email-editor/email-nodes
 */

/**
 * A field in the text, by its name ("Venue", "First names") as a quiet
 * tint, as a contract's and an invoice's fields are drawn while editing
 * (founder, 2026-10-21: an email's read as a value underlined in green,
 * with a Show fields switch to tell them apart). The sample couple's
 * values show in the builder's Preview, as the client gets it.
 */
function VariableChip({ node, selected }: NodeViewProps) {
  const id = String(node.attrs.id ?? '');
  const name = id.charAt(0).toUpperCase() + id.slice(1);
  return (
    <NodeViewWrapper as="span" className={`rounded-check bg-grass-500/15 px-[0.2em] ${selected ? 'ring-1 ring-selected' : ''}`}>
      {name}
    </NodeViewWrapper>
  );
}

/** The shared `variable` node, drawn as a field. */
export const EmailVariable = Variable.extend({ addNodeView: () => ReactNodeViewRenderer(VariableChip) });

/**
 * A picked block's ring and, inside its top-right corner, a delete (the
 * founder, 2026-10-08: a cross floating off the corner looked terrible).
 * `bare` leaves the delete out, for a block whose card has its own (the
 * button: a delete on a 44px button would cover its words).
 */
export function Picked({ selected, onRemove, children, label, fit = false, bare = false }: { selected: boolean; onRemove: () => void; children: ReactNode; label: string; fit?: boolean; bare?: boolean }) {
  return (
    <div className={`group relative my-2 rounded-check ${fit ? 'w-fit' : ''} ${selected ? 'outline-2 outline-offset-4 outline-selected' : ''}`} data-drag-handle>
      {children}
      {bare ? null : (
        <button
          type="button"
          aria-label={`Delete ${label}`}
          onClick={onRemove}
          className={`absolute top-2 right-2 z-10 flex size-7 items-center justify-center rounded-check bg-field/90 text-zebra-700 shadow-sm transition-colors duration-150 hover:bg-field hover:text-zebra-950 focus-mark motion-reduce:transition-none ${selected ? '' : 'hidden group-hover:flex'}`}
        >
          <TrashIcon aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}

/**
 * A setting in a block's card: its name muted on the left, the value
 * typed beside it, as the builder's header lines are, so what is a label
 * and what is editable never look alike (founder, 2026-10-08).
 */
export function CardRow({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <div className="flex min-h-9 items-center gap-3 type-body">
      <span className="w-16 shrink-0 text-zebra-500">{label}</span>
      <InlineInput aria-label={label} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1" />
    </div>
  );
}

/** A block card's delete, at its foot: the one word, in line with the names above it. */
export function CardDelete({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div className="mt-1 flex min-h-9 items-center">
      <Button variant="plain" aria-label={`Delete ${label}`} onClick={onRemove}>
        Delete
      </Button>
    </div>
  );
}

function ButtonView({ node, selected, updateAttributes, deleteNode }: NodeViewProps) {
  const label = String(node.attrs.label ?? '');
  return (
    <NodeViewWrapper>
      <Popover open={selected}>
        <PopoverAnchor asChild>
          <div>
            <Picked selected={selected} onRemove={deleteNode} label="button" fit bare>
              <EmailButtonFace label={label || 'Button'} />
            </Picked>
          </div>
        </PopoverAnchor>
        <PopoverContent size="card" align="start" aria-label="Button" onOpenAutoFocus={(e) => e.preventDefault()}>
          <CardRow label="Text" value={label} placeholder="Book a call" onChange={(v) => updateAttributes({ label: v })} />
          <CardRow label="Link" value={String(node.attrs.href ?? '')} placeholder="https://" onChange={(v) => updateAttributes({ href: v })} />
          <CardDelete label="button" onRemove={deleteNode} />
        </PopoverContent>
      </Popover>
    </NodeViewWrapper>
  );
}

function PackagesView({ selected, deleteNode }: NodeViewProps) {
  return (
    <NodeViewWrapper>
      <Picked selected={selected} onRemove={deleteNode} label="packages">
        <PackagesGrid />
      </Picked>
    </NodeViewWrapper>
  );
}

function LinkView({ node, selected, updateAttributes, deleteNode }: NodeViewProps) {
  return (
    <NodeViewWrapper>
      <Picked selected={selected} onRemove={deleteNode} label="document link">
        <AttachmentCard
          what={node.attrs.what === 'form' ? 'form' : 'document'}
          // Renamed in place: the card's own name line is the field.
          name={<InlineInput aria-label={node.attrs.what === 'form' ? 'Form name' : 'Document name'} value={String(node.attrs.name ?? '')} onChange={(e) => updateAttributes({ name: e.target.value })} className="w-full type-label text-zebra-950" />}
          note={String(node.attrs.note ?? '')}
        />
      </Picked>
    </NodeViewWrapper>
  );
}

function SpacerView({ selected, deleteNode }: NodeViewProps) {
  return (
    <NodeViewWrapper>
      <Picked selected={selected} onRemove={deleteNode} label="spacer">
        {/* The spacer is EmailBody's 16px of room, with a little more to click while editing. */}
        <div className={`h-11 rounded-check transition-colors duration-150 motion-reduce:transition-none ${selected ? 'bg-pressed' : 'group-hover:bg-hover'}`} />
      </Picked>
    </NodeViewWrapper>
  );
}

/** A block node: an atom drawn by `view`, its attributes kept as data. */
export function block(name: string, attrs: Record<string, unknown>, view: (p: NodeViewProps) => ReactNode) {
  return Node.create({
    name,
    group: 'block',
    atom: true,
    draggable: true,
    selectable: true,
    addAttributes: () => Object.fromEntries(Object.entries(attrs).map(([k, d]) => [k, { default: d }])),
    parseHTML: () => [{ tag: `div[data-${name}]` }],
    renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { [`data-${name}`]: '' })],
    addNodeView: () => ReactNodeViewRenderer(view),
  });
}

export const EmailButton = block('emailButton', { label: 'Book a call', href: '' }, ButtonView);
export const EmailPackages = block('emailPackages', {}, PackagesView);
export const EmailLink = block('emailLink', { name: 'Your proposal', note: '', what: 'document' }, LinkView);
export const EmailSpacer = block('emailSpacer', {}, SpacerView);
