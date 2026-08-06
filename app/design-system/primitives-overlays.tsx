'use client';

import { Copy, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { RowActionsMenu } from '@/components/ui/row-actions-menu';
import { SidePanel } from '@/components/ui/side-panel';

import { Conflict } from './conflict';
import { Demo, DemoGrid, DemoRow, Spec } from './showroom';

/**
 * Overlay primitives: Modal, SidePanel, ConfirmDialog, RowActionsMenu.
 *
 * The three dialog surfaces are the least consistent part of the system,
 * so each one is openable here for a side-by-side comparison.
 *
 * @module app/design-system/primitives-overlays
 */

const MODAL_SIZES = ['sm', 'md', 'lg', 'xl', '2xl', 'fullscreen'] as const;
type ModalSize = (typeof MODAL_SIZES)[number];

/** The overlay ladder, now declared once in `OVERLAY_Z`. */
const Z_LADDER = [
  { z: 'z-50 / z-[60]', owner: "layer='base' — Modal, SidePanel", file: 'use-overlay.ts' },
  { z: 'z-[75] / z-[80]', owner: "layer='nested' — a modal opened from a modal", file: 'use-overlay.ts' },
  { z: 'z-[90]', owner: 'Popover tier — Select dropdown and friends', file: 'select.tsx' },
  { z: 'z-[120] / z-[130]', owner: "layer='top' — ConfirmDialog", file: 'use-overlay.ts' },
  { z: 'z-[200]', owner: 'Toasts, deliberately above everything', file: 'toast.tsx' },
];

/** All overlay primitives, each openable for comparison. */
export function PrimitivesOverlays() {
  const [modalSize, setModalSize] = useState<ModalSize | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Spec name="Modal" file="components/ui/modal.tsx" description="Six sizes, plus nested, flushBottom and floatingClose modes. Escape closes only the topmost instance.">
        <DemoRow>
          {MODAL_SIZES.map((s) => (
            <Button key={s} size="sm" variant="outline" onClick={() => setModalSize(s)}>
              {s}
            </Button>
          ))}
        </DemoRow>
        <Modal
          isOpen={modalSize !== null}
          onClose={() => setModalSize(null)}
          title={`Modal · size="${modalSize ?? ''}"`}
          size={modalSize ?? 'md'}
          headerActions={<Button size="sm" variant="ghost">Action</Button>}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModalSize(null)}>Cancel</Button>
              <Button onClick={() => setModalSize(null)}>Save</Button>
            </div>
          }
        >
          <div className="space-y-3">
            <Input label="Couple name" placeholder="Alex and Sam" />
            <p className="text-body text-text-muted">
              Body content scrolls independently once it exceeds the panel height.
            </p>
          </div>
        </Modal>
      </Spec>

      <Spec name="SidePanel" file="components/ui/side-panel.tsx" description="Right-hand drawer. One fixed width ladder, no size prop.">
        <Button size="sm" variant="outline" onClick={() => setPanelOpen(true)}>
          Open side panel
        </Button>
        <SidePanel
          isOpen={panelOpen}
          onClose={() => setPanelOpen(false)}
          title="Side panel"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPanelOpen(false)}>Cancel</Button>
              <Button onClick={() => setPanelOpen(false)}>Save</Button>
            </div>
          }
        >
          <p className="text-body text-text-muted">
            Note the header, border and footer treatment against the Modal above.
          </p>
        </SidePanel>
      </Spec>

      <Spec name="ConfirmDialog" file="components/ui/confirm-dialog.tsx" description="Destructive confirmation. Self-contained, not built on Modal.">
        <Button size="sm" variant="danger" onClick={() => setConfirmOpen(true)}>
          Open confirm dialog
        </Button>
        <ConfirmDialog
          open={confirmOpen}
          title="Delete this couple?"
          description="This removes the couple, their events and their tasks. It cannot be undone."
          onConfirm={() => setConfirmOpen(false)}
          onCancel={() => setConfirmOpen(false)}
        />
      </Spec>

      <Conflict
        title="Behaviour is shared now; the surfaces still are not"
        recommendation={
          <>
            All three take Escape, body-scroll locking and backdrop dismissal from{' '}
            <code>useOverlay()</code>, so they cannot drift apart again. What is left is cosmetic:
            Modal and SidePanel still use <code>bg-white</code> and <code>border-gray-200</code>{' '}
            rather than tokens, and Modal is <code>rounded-2xl</code> where the card token is 12px.
            Fold those in when the radius sweep runs.
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-caption">
            <thead>
              <tr className="text-left text-text-subtle">
                <th className="pb-1 font-medium">Behaviour</th>
                <th className="pb-1 font-medium">Modal</th>
                <th className="pb-1 font-medium">SidePanel</th>
                <th className="pb-1 font-medium">ConfirmDialog</th>
              </tr>
            </thead>
            <tbody className="text-text-muted">
              {[
                ['Closes on Escape', 'Depth-aware', 'Depth-aware', 'Depth-aware'],
                ['Locks body scroll', 'Yes', 'Yes', 'Yes'],
                ['aria-modal', 'Yes', 'Yes', 'Yes'],
                ['role="dialog"', 'On panel', 'On panel', 'On panel'],
                ['Corner radius', 'rounded-2xl (16px)', 'None', 'rounded-card (12px)'],
                ['Surface colour', 'bg-white', 'bg-white', 'bg-surface'],
                ['Border colour', 'border-gray-200', 'border-gray-200', 'border-border'],
                ['Action buttons', 'Caller supplies', 'Caller supplies', 'Button primitive'],
                ['Size options', 'Six', 'One', 'One (max-w-sm)'],
              ].map(([k, ...cells]) => (
                <tr key={k} className="border-t border-border/60">
                  <td className="py-1 pr-3 font-medium text-text whitespace-nowrap">{k}</td>
                  {cells.map((c, i) => (
                    <td key={i} className="py-1 pr-3">{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Conflict>

      <Conflict
        title="Overlay surfaces use rounded-2xl, but the card token is 12px"
        recommendation={
          <>
            Modal and ConfirmDialog both hard-code <code>rounded-2xl</code> (16px) while{' '}
            <code>--radius-card</code> is 12px, so a modal never matches the cards inside it. Either
            move both to <code>rounded-card</code>, or add a dedicated{' '}
            <code>--radius-overlay</code> token so the 16px is a deliberate choice rather than an
            accident.
          </>
        }
      >
        <DemoRow>
          <div className="space-y-1 text-center">
            <div className="h-16 w-24 rounded-card border border-border bg-surface-muted" />
            <code className="text-caption text-text-subtle">rounded-card · 12px</code>
          </div>
          <div className="space-y-1 text-center">
            <div className="h-16 w-24 rounded-2xl border border-border bg-surface-muted" />
            <code className="text-caption text-text-subtle">rounded-2xl · 16px</code>
          </div>
        </DemoRow>
      </Conflict>

      <Conflict
        title="The primitives share one ladder; call sites still hard-code theirs"
        recommendation={
          <>
            The overlap is gone: <code>z-[80]</code> used to be claimed by both the nested Modal
            panel and the ConfirmDialog panel, so a confirm raised from a nested modal stacked by
            DOM order rather than intent. ConfirmDialog now owns the <code>top</code> tier. The
            ladder below lives in <code>OVERLAY_Z</code> (<code>use-overlay.ts</code>), but roughly
            a hundred call sites still write raw <code>z-[…]</code> values across fifteen tiers,
            including a <code>z-[9999]</code> in <code>add-status-modal.tsx</code>. Point those at{' '}
            <code>OVERLAY_Z</code> as each page gets hardened.
          </>
        }
      >
        <ul className="space-y-1 text-caption text-text-muted">
          {Z_LADDER.map((r) => (
            <li key={r.z} className="flex flex-wrap gap-x-2">
              <code className="w-16 shrink-0 text-text">{r.z}</code>
              <span className="flex-1">{r.owner}</span>
              <code className="text-text-subtle">{r.file}</code>
            </li>
          ))}
        </ul>
      </Conflict>

      <Spec name="RowActionsMenu" file="components/ui/row-actions-menu.tsx" description="Popover kebab menu. Two sizes, optional submenus, destructive items.">
        <DemoGrid cols={2}>
          <Demo label="md (default)">
            <RowActionsMenu
              alwaysVisible
              actions={[
                { label: 'Edit', onSelect: () => {}, icon: <Pencil size={14} strokeWidth={1.5} /> },
                { label: 'Duplicate', onSelect: () => {}, icon: <Copy size={14} strokeWidth={1.5} /> },
                { label: 'Delete', onSelect: () => {}, destructive: true, icon: <Trash2 size={14} strokeWidth={1.5} /> },
              ]}
            />
          </Demo>
          <Demo label="sm, with a submenu">
            <RowActionsMenu
              alwaysVisible
              size="sm"
              actions={[{ label: 'Edit', onSelect: () => {} }]}
              submenus={[
                {
                  label: 'Snooze',
                  items: [
                    { label: 'Tomorrow', onSelect: () => {} },
                    { label: 'Next week', onSelect: () => {} },
                  ],
                },
              ]}
            />
          </Demo>
        </DemoGrid>
      </Spec>
    </>
  );
}
