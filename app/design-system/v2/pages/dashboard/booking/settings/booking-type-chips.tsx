'use client';

import { useCallback, useState } from 'react';

import { CalendarRangeIcon, CallIcon, ClockIcon, CoffeeIcon, HourglassIcon, VenueIcon, VideoIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';
import { InlineInput } from '@/components/ui-v2/inline-input';
import { MenuOption } from '@/components/ui-v2/popover';
import { PropertyChip } from '@/components/ui-v2/property-chip';

import {
  BREAK_UNITS,
  LENGTH_PICKS,
  LENGTH_UNITS,
  NOTICE_PICKS,
  NOTICE_UNITS,
  WHERE,
  WHERE_LABEL,
  WINDOW_PICKS,
  WINDOW_UNITS,
  breakLabel,
  noticeLabel,
  spanLabel,
  windowLabel,
  type BookingLink,
  type Where,
} from '../booking-data';

import { SpanField, SpanPicker } from './span-picker';

/**
 * The chips under a booking type's name in its sheet, as New client's
 * details sit under the couple's names. Each reads as a plain sentence
 * of what it does ("30 min long", "At least 1 day's notice") and opens a
 * line saying so, a few quick picks and a field to type any time. Every
 * one starts filled with a sensible default, so only the name is needed.
 * Where opens a line for the address under In person, as Venue does.
 * Controlled: the sheet holds the draft.
 *
 * @module app/design-system/v2/pages/dashboard/booking/settings/booking-type-chips
 */

type Which = 'length' | 'where' | 'breaks' | 'notice' | 'window';

const WHERE_ICON: Record<Where, ZebriIcon> = { video: VideoIcon, phone: CallIcon, 'in-person': VenueIcon };

export interface BookingTypeChipsProps {
  value: BookingLink;
  onChange: (patch: Partial<BookingLink>) => void;
}

/** The chip row. See {@link BookingTypeChipsProps}. */
export function BookingTypeChips({ value: v, onChange }: BookingTypeChipsProps) {
  const [open, setOpen] = useState<Which | null>(null);
  // Picking In person shows the address line inside the open menu, after
  // the popover's own autofocus has run, so it takes focus as it appears.
  const focusOnMount = useCallback((el: HTMLInputElement | null) => el?.focus(), []);
  const toggle = (w: Which) => (o: boolean) => setOpen(o ? w : null);
  const pick = (patch: Partial<BookingLink>, done = true) => (onChange(patch), done ? setOpen(null) : undefined);
  const where = v.where === 'in-person' && v.address.trim() ? `In person · ${v.address.trim()}` : WHERE_LABEL[v.where];

  return (
    <div className="-mx-2.5 flex flex-wrap gap-1">
      <PropertyChip icon={ClockIcon} label="Length" value={`${spanLabel(v.length)} long`} open={open === 'length'} onOpenChange={toggle('length')} size="menu">
        <SpanPicker
          label="Length"
          about="How long each booking lasts. Couples pick a start time and get this long with you."
          picks={LENGTH_PICKS}
          value={v.length}
          units={LENGTH_UNITS}
          fallback="min"
          placeholder="1 hr 30"
          show={spanLabel}
          onChange={(length, done) => pick({ length }, done)}
        />
      </PropertyChip>
      <PropertyChip icon={WHERE_ICON[v.where]} label="Where" value={where} open={open === 'where'} onOpenChange={toggle('where')} size="menu">
        <div className="w-72">
          <p className="px-2 pb-2 pt-1.5 type-body text-zebra-500">How you meet. Video calls get their link added for you.</p>
          {/* In person stays open for its address; the other two are done in one click. */}
          {WHERE.map((w) => (
            <MenuOption key={w} selected={w === v.where} onSelect={() => pick({ where: w }, w !== 'in-person')}>
              {WHERE_LABEL[w]}
            </MenuOption>
          ))}
          {v.where === 'in-person' ? (
            <div className="mt-1 flex h-8 items-center gap-2 px-2">
              <VenueIcon aria-hidden="true" className="size-4 shrink-0 text-zebra-400" />
              <InlineInput
                aria-label="Address"
                placeholder="Your studio, or their venue"
                autoComplete="off"
                value={v.address}
                onChange={(e) => onChange({ address: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  setOpen(null);
                }}
                className="min-w-0 flex-1 type-body"
                ref={focusOnMount}
              />
            </div>
          ) : null}
        </div>
      </PropertyChip>
      <PropertyChip icon={CoffeeIcon} label="Breaks" value={breakLabel(v)} open={open === 'breaks'} onOpenChange={toggle('breaks')} size="menu">
        <div className="w-80 space-y-2 px-2 pb-1.5 pt-1.5">
          <p className="text-pretty type-body text-zebra-500">Time kept free around each booking, so you are never straight from one call into the next.</p>
          {(['before', 'after'] as const).map((end) => (
            <div key={end} className="flex items-center justify-between gap-3">
              <span className="type-body text-zebra-950">{end === 'before' ? 'Before' : 'After'}</span>
              <SpanField label={`Break ${end}`} value={v[end]} units={BREAK_UNITS} fallback="min" min={0} placeholder="15 min" onChange={(s) => onChange({ [end]: s })} />
            </div>
          ))}
        </div>
      </PropertyChip>
      <PropertyChip icon={HourglassIcon} label="Notice" value={noticeLabel(v.notice)} open={open === 'notice'} onOpenChange={toggle('notice')} size="menu">
        <SpanPicker
          label="Notice"
          about="How soon a couple can book. With 1 day, nobody can grab a time later today."
          picks={NOTICE_PICKS}
          value={v.notice}
          units={NOTICE_UNITS}
          fallback="day"
          placeholder="12 hrs"
          show={noticeLabel}
          onChange={(notice, done) => pick({ notice }, done)}
        />
      </PropertyChip>
      <PropertyChip icon={CalendarRangeIcon} label="How far ahead" value={windowLabel(v.window)} open={open === 'window'} onOpenChange={toggle('window')} size="menu">
        <SpanPicker
          label="How far ahead"
          about="How far into the future couples can book. Times further out than this stay hidden."
          picks={WINDOW_PICKS}
          value={v.window}
          units={WINDOW_UNITS}
          fallback="month"
          placeholder="6 weeks"
          show={windowLabel}
          onChange={(window, done) => pick({ window }, done)}
        />
      </PropertyChip>
    </div>
  );
}
