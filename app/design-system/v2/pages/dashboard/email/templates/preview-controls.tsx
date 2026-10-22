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
 * sample couple. Changes apply at once. The one set of controls over
 * every email preview: Email's templates and campaigns, and Journeys'
 * step dialog and email builder (which leave out the inbox, `onClient`,
 * where the inbox does not apply).
 *
 * @module app/design-system/v2/pages/dashboard/email/templates/preview-controls
 */

export interface PreviewControlsProps {
  client?: Client | undefined;
  /** Leave out to drop the inbox picker (an editor, where no inbox applies). */
  onClient?: ((c: Client) => void) | undefined;
  device: Device;
  onDevice: (d: Device) => void;
  showFields: boolean;
  onShowFields: (on: boolean) => void;
}

const deviceLabel = (d: Device) => DEVICES.find((x) => x.value === d)!.label;

/** The controls. See {@link PreviewControlsProps}. */
export function PreviewControls({ client = 'apple', onClient, device, onDevice, showFields, onShowFields }: PreviewControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      {onClient ? <Dropdown inline label="Inbox" options={CLIENTS} value={client} onChange={(v) => onClient(v as Client)} /> : null}
      {client === 'web' ? null : (
        <Segmented
          label="Device"
          options={DEVICES.map((d) => d.label)}
          value={deviceLabel(device)}
          onChange={(label) => onDevice(DEVICES.find((d) => d.label === label)!.value)}
        />
      )}
      <label className="ml-auto flex items-center gap-2 type-body text-zebra-500">
        <Switch checked={showFields} onChange={onShowFields} aria-label="Show fields" />
        Show fields
      </label>
    </div>
  );
}
