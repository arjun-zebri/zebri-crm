'use client';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DIALOG_FOOTER_PAD, DIALOG_HEADER_PAD, useSend } from '@/components/ui-v2/dialog-parts';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import {
  BdmIcon,
  BuildingIcon,
  CalendarClockIcon,
  CalendarIcon,
  CloseIcon,
  EmailIcon,
  EnquiriesIcon,
  SettingsIcon,
} from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';

import { useBdmOn } from '../bdm/bdm-store';
import { CelebrantTab } from '../bdm/settings/celebrant-tab';
import { BookingLinksTab } from '../booking/settings/booking-links-tab';
import { openSheet } from '../booking/use-booking-links';
import { CalendarTab } from '../calendar/settings/calendar-tab';
import { EnquiriesTab } from '../enquiries/settings/enquiries-tab';

import { BusinessTab } from './business-tab';
import { EmailTab } from './email-tab';
import { closeSettings, openSettings, useSettingsOpen, type SettingsTab } from './settings-store';

/**
 * Settings, opened from the sidebar's gear or the Enquiries popover:
 * a top bar across the dialog (the gear in its circle, centred over the
 * tab icons, "Settings" quiet beside it, Close at the right, above
 * everything under it), its hairline meeting the rail's so the lines
 * join (user, 2026-10-15), then a white rail on the left (the user's
 * call) with one row per tab
 * (there will be many, so a rail, not a tab row), and the picked tab on
 * the right with no heading of its own (the rail names it; repeating it
 * was rejected). A `split-tall` dialog, fixed height and 56rem wide: the
 * `xl` record size left settings rows stretched across white space, and
 * `split` had no room for the Save at the bottom right (user,
 * 2026-10-15), which shows a beat of work and then shuts Settings. Each
 * feature owns its tab's content (`enquiries/settings/`, Business and
 * Email here, moved out of the brand kit 2026-10-11,
 * `calendar/settings/`, `booking/settings/`); the shell
 * only lists them. Switching tabs fades the content in, the v2 panel
 * swap. The content has the modal padding (New client's) and stretches
 * to its width. On phones the rail becomes a sideways row above the
 * content.
 *
 * @module app/design-system/v2/pages/dashboard/settings/settings-dialog
 */

const TABS: { id: SettingsTab; label: string; icon: ZebriIcon }[] = [
  { id: 'business', label: 'Business', icon: BuildingIcon },
  { id: 'email', label: 'Email', icon: EmailIcon },
  { id: 'enquiries', label: 'Enquiries', icon: EnquiriesIcon },
  { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
  { id: 'booking-links', label: 'Booking links', icon: CalendarClockIcon },
  // Only once the block is added: it is a celebrant's, and most accounts never need it.
  { id: 'lodge-with-bdm', label: 'Lodge with BDM', icon: BdmIcon },
];

/** Shuts Settings, and any booking type sheet over it, so Settings never reopens mid-edit. */
const close = () => {
  closeSettings();
  openSheet(null);
};

/** The Settings dialog. Render once per page; open it with `openSettings`. */
export function SettingsDialog() {
  const tab = useSettingsOpen();
  const bdm = useBdmOn();
  const tabs = TABS.filter((t) => bdm || t.id !== 'lodge-with-bdm');
  const current = tabs.find((t) => t.id === tab);
  const { busy, send } = useSend();
  return (
    <Dialog open={tab !== null} onClose={close} size="split-tall" aria-labelledby="settings-title">
      {/* A top bar across the whole dialog, so Close sits above everything
          under it. Its hairline meets the rail's, so the lines join. The
          circle (32px) sits 16px in, centring it over the tab icons below
          (the rail's 12px plus each tab's 12px, to an icon's 8px middle). */}
      <header className={`flex shrink-0 items-center gap-2 border-b border-hairline ${DIALOG_HEADER_PAD}`}>
        <IconCircle icon={SettingsIcon} />
        <h2 id="settings-title" className="type-label text-zebra-500">
          Settings
        </h2>
        <div className="ml-auto">
          <Button variant="ghost" square aria-label="Close" onClick={close}>
            <CloseIcon aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex shrink-0 flex-col border-b border-hairline p-3 md:w-56 md:overflow-y-auto md:border-b-0 md:border-r">
          <nav
            aria-label="Settings"
            className="-mx-3 flex gap-0.5 overflow-x-auto px-3 md:mx-0 md:flex-col md:px-0"
          >
            {tabs.map(({ id, label, icon: Icon }) => {
              const on = id === tab;
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={on ? 'page' : undefined}
                  onClick={() => openSettings(id)}
                  className={`group flex h-9 shrink-0 items-center gap-3 whitespace-nowrap rounded-button px-3 transition-colors duration-150 focus-mark motion-reduce:transition-none ${
                    on
                      ? 'bg-pressed type-label text-zebra-950'
                      : 'type-body text-zebra-600 hover:bg-hover hover:text-zebra-950'
                  }`}
                >
                  <Icon
                    aria-hidden="true"
                    className={`size-4 shrink-0 ${on ? 'text-zebra-950' : 'text-zebra-400 group-hover:text-zebra-600'}`}
                  />
                  {label}
                </button>
              );
            })}
          </nav>
        </div>
        {current ? (
          <div
            key={current.id}
            className="flex min-h-0 min-w-0 flex-1 flex-col motion-safe:animate-fade-in"
          >
            {/* No heading naming the tab: the rail already does (user ruling).
              The modal padding, New client's (24px, 40px from sm). */}
            <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-10">
              {current.id === 'business' ? <BusinessTab /> : null}
              {current.id === 'email' ? <EmailTab /> : null}
              {current.id === 'enquiries' ? <EnquiriesTab /> : null}
              {current.id === 'calendar' ? <CalendarTab /> : null}
              {current.id === 'booking-links' ? <BookingLinksTab /> : null}
              {current.id === 'lodge-with-bdm' ? <CelebrantTab /> : null}
            </div>
            {/* Mirrors the X you see, not its 36px hit area: the glyph sits
                22px in from the top and right (12px bar padding plus 10px
                inside the ghost button), so Save sits 22px in from the right
                and bottom, its edge under the X's (user, 2026-10-15). */}
            <footer className={`flex shrink-0 justify-end ${DIALOG_FOOTER_PAD}`}>
              <Button loading={busy} onClick={() => send(close)}>
                Save
              </Button>
            </footer>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
