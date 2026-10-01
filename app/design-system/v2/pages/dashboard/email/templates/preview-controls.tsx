'use client';

import { Dropdown } from '@/components/ui-v2/dropdown';
import { Segmented } from '@/components/ui-v2/segmented';
import { Switch } from '@/components/ui-v2/switch';

import { CLIENTS, DEVICES, type Client, type Device } from '../render/quirks';

/**
 * The controls over a template preview: which inbox (a `Dropdown`, since
 * five names overflow a segmented track), which device (a `Segmented`,
 * left out for the web version, which is always a browser), and Show
 * fields, which marks what changes per couple instead of filling in the
 * sample couple. Changes apply at once.
 *
 * @module app/design-system/v2/pages/dashboard/email/templates/preview-controls
 */

export interface PreviewControlsProps {
  client: Client;
  onClient: (c: Client) => void;
  device: Device;
  onDevice: (d: Device) => void;
  showFields: boolean;
  onShowFields: (on: boolean) => void;
}

const deviceLabel = (d: Device) => DEVICES.find((x) => x.value === d)!.label;

/** The controls. See {@link PreviewControlsProps}. */
export function PreviewControls({ client, onClient, device, onDevice, showFields, onShowFields }: PreviewControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <Dropdown inline label="Inbox" options={CLIENTS} value={client} onChange={(v) => onClient(v as Client)} />
      {client === 'web' ? null : (
        <Segmented
          label="Device"
          options={DEVICES.map((d) => d.label)}
          value={deviceLabel(device)}
          onChange={(label) => onDevice(DEVICES.find((d) => d.label === label)!.value)}
        />
      )}
      <label className="ml-auto flex items-center gap-2 type-body text-zebra-600">
        <Switch checked={showFields} onChange={onShowFields} aria-label="Show fields" />
        Show fields
      </label>
    </div>
  );
}
