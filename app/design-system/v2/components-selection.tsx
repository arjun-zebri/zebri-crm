'use client';

import { CalendarDays, MapPin, Plus } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { ChipGroup } from '@/components/ui-v2/chip-group';
import { ChoiceCard } from '@/components/ui-v2/choice-card';
import { ColorField } from '@/components/ui-v2/color-field';
import { formatDate } from '@/components/ui-v2/date-field';
import { Dropdown } from '@/components/ui-v2/dropdown';
import { FileDrop } from '@/components/ui-v2/file-drop';
import { FilterChip } from '@/components/ui-v2/filter-chip';
import { PropertyChip } from '@/components/ui-v2/property-chip';
import { RangeCalendar } from '@/components/ui-v2/range-calendar';
import { Segmented } from '@/components/ui-v2/segmented';
import { Select } from '@/components/ui-v2/select';
import { Tabs, tabId } from '@/components/ui-v2/tabs';
import { TagList } from '@/components/ui-v2/tag-list';

import { Demo, DemoRow, Group, Spec } from './showroom-v2';

const FONTS = [
  { value: 'Fraunces', label: 'Fraunces', fontFamily: '"Fraunces", serif' },
  { value: 'Playfair Display', label: 'Playfair Display', fontFamily: '"Playfair Display", serif' },
  { value: 'Inter', label: 'Inter', fontFamily: 'Inter, sans-serif' },
];

/**
 * v2 selection: chips, segmented, choice cards, select and dropdown,
 * colour and file fields, and the tag list. Client-side because each
 * demo holds a selection.
 *
 * @module app/design-system/v2/components-selection
 */
export function ComponentsSelectionV2() {
  const [roles, setRoles] = useState<string[]>(['MC']);
  const [spacing, setSpacing] = useState<string[]>(['Cozy']);
  const [to, setTo] = useState<string[]>(['Ella', 'Noah']);
  const [doc, setDoc] = useState<'Proposal' | 'Contract' | 'Invoice'>('Proposal');
  const [view, setView] = useState<'for-you' | 'board' | 'list'>('for-you');
  const [plan, setPlan] = useState('pro');
  const [font, setFont] = useState('Fraunces');
  const [role, setRole] = useState('MC');
  const [colour, setColour] = useState('#2f521f');
  const [included, setIncluded] = useState<string[]>(['Legal paperwork', 'Rehearsal']);
  const [service, setService] = useState<string[]>([]);
  const [eventDate, setEventDate] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [venueOpen, setVenueOpen] = useState(false);
  const [venue, setVenue] = useState<string[]>(['curzon', 'bells', 'hawthorn']);
  return (
    <Group id="selection" title="Selection">
      <Spec name="Chip group" file="components/ui-v2/chip-group.tsx" description="A few short options picked by tapping; one or several (multiple). hints adds a muted note inside a chip; inline puts a muted label in a narrow column to the left, for short rows in a compact form (the reminder's To and Via).">
        <DemoRow>
          <ChipGroup multiple label="What you do" description="Select all that apply" options={['MC', 'Celebrant', 'DJ', 'Other']} value={roles} onChange={setRoles} />
          <ChipGroup label="Spacing" options={['Compact', 'Cozy', 'Roomy']} value={spacing} onChange={setSpacing} />
          <ChipGroup inline multiple label="To" options={['Ella', 'Noah']} hints={{ Ella: 'opened last time', Noah: 'noah.k@gmail.com' }} value={to} onChange={setTo} />
        </DemoRow>
      </Spec>
      <Spec name="Segmented" file="components/ui-v2/segmented.tsx" description="Two to five views or a small setting in one track.">
        <Segmented label="Document" options={['Proposal', 'Contract', 'Invoice'] as const} value={doc} onChange={setDoc} />
      </Spec>
      <Spec
        name="Filter chip"
        file="components/ui-v2/filter-chip.tsx"
        description="One multi-select filter on a view, for a list that can grow (every service an MC offers), where a segmented row would overflow. Unset it is a quiet dashed chip naming what it filters, or with `placeholder` a filled chip saying what shows now (“All services”), for a chart where no filter is the view being read; set, it shows the filter and up to two names (else a count) with a × to clear. The menu is a search box over checkboxes and stays open while ticking; Clear empties it."
      >
        <DemoRow>
          <FilterChip
            label="Service"
            options={[
              { value: 'mc', label: 'MC' },
              { value: 'mc-celebrant', label: 'MC + Celebrant' },
              { value: 'celebrant', label: 'Celebrant' },
              { value: 'corporate', label: 'Corporate' },
            ]}
            value={service}
            onChange={setService}
            placeholder="All services"
          />
          <FilterChip
            label="Venue"
            options={['Curzon Hall', 'Bells at Killcare', 'Hawthorn Hall', 'The Grounds', 'Gunners Barracks', 'Centennial Homestead', 'Stones of the Yarra Valley', 'Quarantine Station'].map((v) => ({
              value: v.split(' ')[0]!.toLowerCase(),
              label: v,
            }))}
            value={venue}
            onChange={setVenue}
          />
        </DemoRow>
      </Spec>
      <Spec
        name="Property chip"
        file="components/ui-v2/property-chip.tsx"
        description="One optional detail of a thing being created, under its name, as Linear's New issue sets a due date: empty, a quiet chip naming what it holds; filled, the value in black on a soft fill. It opens its picker in a popover (a calendar, a short field) and the caller owns open, so a picker closes itself once a value is chosen. Used for the event date and venue in New client."
      >
        <DemoRow>
          <PropertyChip
            icon={CalendarDays}
            label="Event date"
            value={eventDate ? formatDate(eventDate) : undefined}
            open={dateOpen}
            onOpenChange={setDateOpen}
          >
            <RangeCalendar from={eventDate} to={eventDate} onPick={(d) => (setEventDate(d), setDateOpen(false))} />
          </PropertyChip>
          <PropertyChip icon={MapPin} label="Venue" value="The Boathouse, Sydney" open={venueOpen} onOpenChange={setVenueOpen}>
            <p className="type-body text-zebra-500">A short field goes here.</p>
          </PropertyChip>
        </DemoRow>
      </Spec>
      <Spec name="Tabs" file="components/ui-v2/tabs.tsx" description="The views of a whole page. An ink bar marks the current one; arrow keys move between them. A dot flags a view with something new. A count is quiet by default; countOf colours it and names what it counts (red for overdue, amber for waiting) so it is never read as the tab total.">
        <Tabs
          id="demo-view"
          label="View"
          items={[
            { value: 'for-you', label: 'For you', count: 5, dot: true },
            { value: 'board', label: 'Board', count: 2, countOf: { word: 'overdue', tone: 'danger' } },
            { value: 'list', label: 'List' },
          ]}
          value={view}
          onChange={setView}
        />
        <p role="tabpanel" aria-labelledby={tabId('demo-view', view)} className="type-body text-zebra-500">
          Showing the {view === 'for-you' ? 'For you' : view === 'board' ? 'Board' : 'List'} view.
        </p>
      </Spec>
      <Spec name="Choice card" file="components/ui-v2/choice-card.tsx" description="A pick that needs a line of explanation. Add check for a multi-select card with a corner mark.">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['starter', 'Starter', 'Your first few weddings'],
            ['pro', 'Pro', 'A full season of weddings'],
            ['max', 'Max', 'Event day and a team'],
          ].map(([id = '', name, pitch]) => (
            <ChoiceCard key={id} selected={plan === id} onClick={() => setPlan(id)}>
              <span className="flex items-center gap-2 type-subheading">
                {name}
                {id === 'pro' ? <Badge tone="brand">Popular</Badge> : null}
              </span>
              <span className="type-body text-zebra-500">{pitch}</span>
            </ChoiceCard>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['MC', 'Receptions and events'],
            ['Celebrant', 'Ceremonies'],
            ['DJ', 'Music and sets'],
          ].map(([name = '', line]) => (
            <ChoiceCard key={name} check selected={roles.includes(name)} onClick={() => setRoles((r) => (r.includes(name) ? r.filter((x) => x !== name) : [...r, name]))} className="gap-6">
              <span>
                <span className="block type-label">{name}</span>
                <span className="block type-body text-zebra-500">{line}</span>
              </span>
            </ChoiceCard>
          ))}
        </div>
      </Spec>
      <Spec
        name="Select & dropdown"
        file="components/ui-v2/dropdown.tsx"
        description="Select is the native control, for a plain list of names. Dropdown is a custom menu, for options shown rather than named (each font in its face); inline puts the pick inside a sentence."
      >
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <Select label="Heading font (Select)" options={['Fraunces', 'Inter', 'Playfair', 'DM Sans']} defaultValue="Fraunces" />
          <Dropdown label="Heading font (Dropdown)" value={font} onChange={setFont} options={FONTS} />
          <Demo label="Inline">
            <p className="flex items-center gap-1 type-body text-zebra-500">
              Recommended for
              <Dropdown inline label="Role" value={role} onChange={setRole} options={['MC', 'Celebrant', 'DJ'].map((r) => ({ value: r, label: r }))} />
            </p>
          </Demo>
        </div>
      </Spec>
      <Spec name="Colour & file" file="components/ui-v2/color-field.tsx" description="Colour opens the app's picker from a swatch beside a hex field; inside a Dialog the picker opens in front of it (it portals into the enclosing dialog, as Dropdown does). File drop takes a drag or a browse.">
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <ColorField label="Primary colour" value={colour} onChange={setColour} />
          <FileDrop label="Logo" accept="image/*" help="PNG or SVG, 512×512 or larger." />
        </div>
      </Spec>
      <Spec name="Tag list" file="components/ui-v2/tag-list.tsx" description="Items the user wrote, each removable; adding and removing animate.">
        <TagList
          label="What's included"
          items={included}
          onRemove={(item) => setIncluded(included.filter((i) => i !== item))}
          after={
            <Button variant="plain" onClick={() => setIncluded([...included, `Extra ${included.length + 1}`])}>
              <Plus aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
              Add one
            </Button>
          }
        />
      </Spec>
    </Group>
  );
}
