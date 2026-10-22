'use client';

import { Button } from '@/components/ui-v2/button';
import { ChipGroup } from '@/components/ui-v2/chip-group';
import { Collapse } from '@/components/ui-v2/collapse';

import { SettingsSection } from '../../enquiries/settings/pane-parts';
import { WEEKDAYS, type DayHours, type DayOff, type Weekday } from '../booking-data';
import { setAllHours, setHours, setPerDay } from '../use-booking-links';

import { DaysOff } from './days-off';
import { HoursChip } from './hours-chip';

/**
 * When the MC takes bookings, shared by every booking type. Most keep
 * one set of hours, so it is one line: the days as soft chips (light
 * green with a tick when on, no border, unlike bordered toggles), and
 * one hours chip. "Different hours on some days" opens a quiet line per
 * working day on the same label grid, each with its own hours chip, for the exceptions. Days
 * off sit under it. Replaced seven rows of switches and loose times.
 *
 * @module app/design-system/v2/pages/dashboard/booking/settings/availability-section
 */

const SHORT: Record<Weekday, string> = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };

export interface AvailabilitySectionProps {
  hours: Readonly<Record<Weekday, DayHours>>;
  perDay: boolean;
  daysOff: readonly DayOff[];
}

/** The availability section. See {@link AvailabilitySectionProps}. */
export function AvailabilitySection({ hours, perDay, daysOff }: AvailabilitySectionProps) {
  const on = WEEKDAYS.filter((d) => hours[d].on);
  const first = hours[on[0] ?? 'Monday'];
  return (
    <div className="space-y-8">
      <SettingsSection title="When you're free" why="Every booking type uses these hours.">
        <div>
          <div className="space-y-3">
            <ChipGroup
              label="Days"
              inline
              multiple
              soft
              options={WEEKDAYS.map((d) => SHORT[d])}
              value={on.map((d) => SHORT[d])}
              onChange={(next) => WEEKDAYS.forEach((d) => setHours(d, { on: next.includes(SHORT[d]) }))}
            />
            <div className="flex items-center gap-4">
              <span className="w-14 shrink-0 type-body text-zebra-500">Hours</span>
              <div className="flex flex-wrap items-center gap-1">
                {perDay ? null : <HoursChip label="Hours" from={first.from} to={first.to} onChange={setAllHours} />}
                <Button variant="plain" aria-expanded={perDay} onClick={() => setPerDay(!perDay)} className="ml-2">
                  {perDay ? 'Same hours every day' : 'Different hours on some days'}
                </Button>
              </div>
            </div>
          </div>
          {/* The gap above lives inside the fold, so a shut one leaves no extra space. Each day sits on
              the same grid as Days and Hours: its name in the label column, its times where the chips
              start, so every value's text shares one edge. */}
          <Collapse open={perDay}>
            <ul className="space-y-1 pt-1">
              {on.map((d) => (
                <li key={d} className="flex items-center gap-4">
                  <span className="w-14 shrink-0 type-body text-zebra-500">{SHORT[d]}</span>
                  <HoursChip label={`${d}'s hours`} from={hours[d].from} to={hours[d].to} onChange={(from, to) => setHours(d, { from, to })} quiet />
                </li>
              ))}
            </ul>
          </Collapse>
        </div>
      </SettingsSection>
      <SettingsSection title="Days off" why="Holidays and anything else away from work.">
        <DaysOff daysOff={daysOff} />
      </SettingsSection>
    </div>
  );
}
