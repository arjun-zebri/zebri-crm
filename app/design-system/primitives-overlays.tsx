'use client';

import { Check, Copy, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { MenuItem, MenuLabel, MenuPanel, MenuSeparator } from '@/components/ui/menu';
import { Modal } from '@/components/ui/modal';
import { RowActionsMenu } from '@/components/ui/row-actions-menu';
import { SidePanel } from '@/components/ui/side-panel';

import { Demo, DemoGrid, DemoRow, Rule, Spec } from './showroom';

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

/** The stacking ladder, declared once in `OVERLAY_Z`. */
const Z_LADDER = [
  { layer: "layer='base'", z: 'z-50 / z-[60]', owner: 'Modal (default), SidePanel' },
  { layer: "layer='nested'", z: 'z-[75] / z-[80]', owner: 'A modal opened from another modal' },
  { layer: '(popover)', z: 'z-[90]', owner: 'Select dropdown, popovers' },
  { layer: "layer='top'", z: 'z-[120] / z-[130]', owner: 'ConfirmDialog' },
  { layer: '(toast)', z: 'z-[200]', owner: 'Toast, above everything by design' },
];

/** All overlay primitives, each openable for comparison. */
export function PrimitivesOverlays() {
  const [modalSize, setModalSize] = useState<ModalSize | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Spec name="Modal" file="components/ui/modal.tsx"
        importPath="@/components/ui/modal" description="Six sizes, plus nested, flushBottom and floatingClose modes. Escape closes only the topmost instance.">
        <DemoRow>
          {MODAL_SIZES.map((s) => (
            <Button key={s} variant="outline" onClick={() => setModalSize(s)}>
              {s}
            </Button>
          ))}
        </DemoRow>
        <Modal
          isOpen={modalSize !== null}
          onClose={() => setModalSize(null)}
          title={`Modal · size="${modalSize ?? ''}"`}
          size={modalSize ?? 'md'}
          headerActions={<Button variant="ghost">Action</Button>}
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

      <Spec name="SidePanel" file="components/ui/side-panel.tsx"
        importPath="@/components/ui/side-panel" description="Right-hand drawer. One fixed width ladder, no size prop.">
        <Button variant="outline" onClick={() => setPanelOpen(true)}>
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

      <Spec name="ConfirmDialog" file="components/ui/confirm-dialog.tsx"
        importPath="@/components/ui/confirm-dialog" description="Destructive confirmation. Self-contained, not built on Modal.">
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>
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

      <Spec
        name="MenuPanel / MenuItem"
        file="components/ui/menu.tsx"
        importPath="@/components/ui/menu"
        description="The dropdown surface and its rows. Positioning stays with the caller; this owns chrome and row density only. Pass `checked` when the choices are independent: the row becomes a menuitemcheckbox and announces its own state."
      >
        <DemoGrid cols={2}>
          <Demo label="md rows">
            <MenuPanel className="w-56">
              <MenuLabel>Group by</MenuLabel>
              <MenuItem selected>Status</MenuItem>
              <MenuItem>Due date</MenuItem>
              <MenuItem trailing={<span className="text-body text-text-subtle">12</span>}>
                Couple
              </MenuItem>
              <MenuSeparator />
              <MenuItem destructive>Delete group</MenuItem>
            </MenuPanel>
          </Demo>
          <Demo label="sm rows (tighter padding, same type size)">
            <MenuPanel className="w-56">
              <MenuItem size="sm" selected>Status</MenuItem>
              <MenuItem size="sm">Priority</MenuItem>
              <MenuItem size="sm" disabled>Archived</MenuItem>
            </MenuPanel>
          </Demo>
          <Demo label="checkbox rows (independent choices)">
            <MenuPanel className="w-56">
              <MenuItem checked selected trailing={<Check size={14} strokeWidth={1.5} />}>
                Vendor contacts
              </MenuItem>
              <MenuItem checked={false}>The couple</MenuItem>
              <MenuItem checked={false}>Me</MenuItem>
            </MenuPanel>
          </Demo>
        </DemoGrid>
      </Spec>

      <Spec name="Stacking order" file="components/ui/use-overlay.ts" description="Which layer an overlay sits on. Set it with the `layer` prop; never hand-write a z-index.">
        <Rule>
          Overlays take their z-index from <code>OVERLAY_Z</code>, not from a literal. If you need
          a new tier, add it there so the ladder stays in one place.
        </Rule>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-body">
            <thead>
              <tr className="text-left text-text-subtle">
                <th className="pb-1 font-medium">Layer</th>
                <th className="pb-1 font-medium">Backdrop / panel</th>
                <th className="pb-1 font-medium">Used by</th>
              </tr>
            </thead>
            <tbody className="text-text-muted">
              {Z_LADDER.map((r) => (
                <tr key={r.z} className="border-t border-border/60">
                  <td className="py-1 pr-3 whitespace-nowrap font-medium text-text">{r.layer}</td>
                  <td className="py-1 pr-3 whitespace-nowrap"><code>{r.z}</code></td>
                  <td className="py-1">{r.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Spec>

      <Spec name="RowActionsMenu" file="components/ui/row-actions-menu.tsx"
        importPath="@/components/ui/row-actions-menu" description="Popover kebab menu. Two row densities, optional submenus, destructive items.">
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
