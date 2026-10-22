'use client';

import { useEffect } from 'react';

import { DesktopIcon, MobileIcon } from '@/components/ui-v2/icons';
import { Segmented } from '@/components/ui-v2/segmented';
import { ensureBrandFontsStylesheet } from '@/lib/branding/fonts';

import type { Device } from '../../email/render/quirks';

/**
 * Which screen an email is read on, over its preview: a computer or a
 * phone, as Zebri's device icons, each named on hover. Two, not three
 * (founder, 2026-10-21): an email is one 600px column, so an iPad reads
 * it as a computer does. No Show fields: the editor shows each field by
 * its name and the preview by the sample couple's value, as a contract's
 * do. It loads the brand's fonts, so the email under it reads in them.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/email-editor/device-controls
 */

const DEVICES: readonly Device[] = ['desktop', 'phone'];
const LABELS: Record<Device, string> = { desktop: 'Computer', tablet: 'iPad', phone: 'Phone' };
const ICONS = { desktop: DesktopIcon, phone: MobileIcon };

export interface DeviceControlsProps {
  device: Device;
  onDevice: (d: Device) => void;
}

/** The controls. See {@link DeviceControlsProps}. */
export function DeviceControls({ device, onDevice }: DeviceControlsProps) {
  // Every email shown under these controls is in the brand's faces; without them the heading falls back to Times.
  useEffect(() => ensureBrandFontsStylesheet(), []);
  return <Segmented label="Read on" options={DEVICES} labels={LABELS} icons={ICONS} iconsOnly value={device === 'tablet' ? 'desktop' : device} onChange={onDevice} />;
}

/** The email card's width on each screen: the 600px every inbox handles, an iPad's, a phone's. */
export const DEVICE_WIDTH: Record<Device, string> = { desktop: 'max-w-[640px]', tablet: 'max-w-[34rem]', phone: 'max-w-[375px]' };
