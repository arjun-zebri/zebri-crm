'use client';

import { useState } from 'react';

import { AddTile } from '@/components/ui-v2/add-tile';
import { Backdrop } from '@/components/ui-v2/backdrop';
import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { ChipGroup } from '@/components/ui-v2/chip-group';
import { ChoiceCard } from '@/components/ui-v2/choice-card';
import { ColorField } from '@/components/ui-v2/color-field';
import { CornerRemove } from '@/components/ui-v2/corner-remove';
import { formatDate } from '@/components/ui-v2/date-field';
import { Dropdown } from '@/components/ui-v2/dropdown';
import { FileDrop } from '@/components/ui-v2/file-drop';
import { FilterChip } from '@/components/ui-v2/filter-chip';
import { CalendarIcon, VenueIcon, PlusIcon, ShapesIcon, TypeIcon, UploadIcon } from '@/components/ui-v2/icons';
import { CornerRoundIcon, CornerSoftIcon, CornerSquareIcon } from '@/components/ui-v2/icons';
import { PillTabs } from '@/components/ui-v2/pill-tabs';
import { PropertyChip } from '@/components/ui-v2/property-chip';
import { RailTab } from '@/components/ui-v2/rail-tab';
import { RangeCalendar } from '@/components/ui-v2/range-calendar';
import { Segmented } from '@/components/ui-v2/segmented';
import { Slider } from '@/components/ui-v2/slider';
import { Stepper } from '@/components/ui-v2/stepper';
import { SwatchPicker } from '@/components/ui-v2/swatch-picker';
import { Tabs, tabId } from '@/components/ui-v2/tabs';
import { TagList } from '@/components/ui-v2/tag-list';

import { BRAND_COLOURS } from './pages/dashboard/brand/palettes';
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
  const [days, setDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [doc, setDoc] = useState<'Proposal' | 'Contract' | 'Invoice'>('Proposal');
  const [corner, setCorner] = useState<'square' | 'soft' | 'round'>('soft');
  const [rounding, setRounding] = useState(6);
  const [pill, setPill] = useState<'full' | 'ceremony' | 'corporate'>('full');
  const [view, setView] = useState<'for-you' | 'board' | 'list'>('for-you');
  const [plan, setPlan] = useState('pro');
  const [font, setFont] = useState('Fraunces');
  const [role, setRole] = useState('MC');
  const [colour, setColour] = useState('#2f521f');
  const [opacity, setOpacity] = useState(20);
  const [corners, setCorners] = useState(12);
  const [railTab, setRailTab] = useState<string | null>('Elements');
  const [shapes, setShapes] = useState(0);
  const [tiles, setTiles] = useState(['#2f521f', '#c9b79c', '#7a7a74']);
  const [included, setIncluded] = useState<string[]>(['Legal paperwork', 'Rehearsal']);
  const [service, setService] = useState<string[]>([]);
  const [eventDate, setEventDate] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [venueOpen, setVenueOpen] = useState(false);
  const [venue, setVenue] = useState<string[]>(['curzon', 'bells', 'hawthorn']);
  return (
    <Group id="selection" title="Selection">
      <Spec
        name="Chip group"
        file="components/ui-v2/chip-group.tsx"
        description="A few short options picked by tapping; one or several (multiple). hints adds a muted note inside a chip; inline puts a muted label in a narrow column to the left, for short rows in a compact form (the reminder's To and Via). stacked lists the options as boxed rows with a radio or check mark and each hint on a line under its name, beside boxed fields on the couple's public form; two options with no hints (Yes, No) sit side by side."
      >
        <DemoRow>
          <ChipGroup
            multiple
            label="What you do"
            description="Select all that apply"
            options={['MC', 'Celebrant', 'DJ', 'Other']}
            value={roles}
            onChange={setRoles}
          />
          <ChipGroup
            label="Spacing"
            options={['Compact', 'Cozy', 'Roomy']}
            value={spacing}
            onChange={setSpacing}
          />
          <ChipGroup
            inline
            multiple
            label="To"
            options={['Ella', 'Noah']}
            hints={{ Ella: 'opened last time', Noah: 'noah.k@gmail.com' }}
            value={to}
            onChange={setTo}
          />
          <ChipGroup
            inline
            multiple
            soft
            label="Days"
            options={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
            value={days}
            onChange={setDays}
          />
        </DemoRow>
        <div className="mt-6 max-w-md">
          <ChipGroup
            stacked
            label="Spacing (stacked)"
            options={['Compact', 'Cozy', 'Roomy']}
            hints={{ Compact: 'More rows on screen', Roomy: 'Easier to read at a glance' }}
            value={spacing}
            onChange={setSpacing}
          />
        </div>
      </Spec>
      <Spec
        name="Segmented"
        file="components/ui-v2/segmented.tsx"
        description="Two to five views or a small setting in one track. With iconsOnly, a choice that reads better seen than named (the brand kit's corners); the label is still read out and shown on hover."
      >
        <DemoRow>
          <Segmented
            label="Document"
            options={['Proposal', 'Contract', 'Invoice'] as const}
            value={doc}
            onChange={setDoc}
          />
          <Segmented
            label="Corners"
            iconsOnly
            options={['square', 'soft', 'round'] as const}
            labels={{ square: 'Square', soft: 'Soft', round: 'Round' }}
            icons={{ square: CornerSquareIcon, soft: CornerSoftIcon, round: CornerRoundIcon }}
            value={corner}
            onChange={setCorner}
          />
        </DemoRow>
      </Spec>
      <Spec
        name="Stepper"
        file="components/ui-v2/stepper.tsx"
        description="A small whole number nudged down or up (the brand kit's page and button rounding, in pixels). The number keeps its width so the arrows never move; each end greys out at its limit."
      >
        <DemoRow>
          <Stepper label="Page rounding" value={rounding} min={0} max={24} unit="px" onChange={setRounding} />
        </DemoRow>
      </Spec>
      <Spec
        name="Pill tabs"
        file="components/ui-v2/pill-tabs.tsx"
        description="The page's own subjects (a journey per type of work, a Clients view), each with a count, as plain words: the picked one ink and a weight heavier, the rest grey, no pill or fill at rest, only the hover tint. A + can sit at the end. The page's actions beside them are bare icons in one glass pill (`pages/dashboard/bar-icons.tsx`) after a raised, shadowed search."
      >
        {/* A slice of the dashboard's backdrop: the frost only reads over it. */}
        <div className="relative isolate overflow-hidden rounded-panel px-5 py-6">
          <Backdrop contained />
          <PillTabs label="Journey" options={['full', 'ceremony', 'corporate']} labels={{ full: 'Full weddings', ceremony: 'Ceremony only', corporate: 'Corporate' }} counts={{ full: 12, ceremony: 3, corporate: 2 }} value={pill} onChange={setPill} />
        </div>
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
            options={[
              'Curzon Hall',
              'Bells at Killcare',
              'Hawthorn Hall',
              'The Grounds',
              'Gunners Barracks',
              'Centennial Homestead',
              'Stones of the Yarra Valley',
              'Quarantine Station',
            ].map((v) => ({
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
        description="One optional detail of a thing being created, under its name, as Linear's New issue sets a due date: empty, a quiet chip naming what it holds; filled, the value in black on a soft fill. It opens its picker in a popover (a calendar, a short field) and the caller owns open, so a picker closes itself once a value is chosen. Without an icon when the words say enough. Quiet, a set value reads as plain text and tints only on hover, for chips repeated down a list (who runs each run sheet moment). Used for the event date and venue in New client."
      >
        <DemoRow>
          <PropertyChip
            icon={CalendarIcon}
            label="Event date"
            value={eventDate ? formatDate(eventDate) : undefined}
            open={dateOpen}
            onOpenChange={setDateOpen}
          >
            <RangeCalendar
              from={eventDate}
              to={eventDate}
              onPick={(d) => (setEventDate(d), setDateOpen(false))}
            />
          </PropertyChip>
          <PropertyChip
            icon={VenueIcon}
            label="Venue"
            value="The Boathouse, Sydney"
            open={venueOpen}
            onOpenChange={setVenueOpen}
          >
            <p className="type-body text-zebra-500">A short field goes here.</p>
          </PropertyChip>
          <PropertyChip
            quiet
            label="Who"
            value="DJ"
            open={false}
            onOpenChange={() => undefined}
            size="menu"
          >
            <p className="type-body text-zebra-500">A list goes here.</p>
          </PropertyChip>
        </DemoRow>
      </Spec>
      <Spec
        name="Tabs"
        file="components/ui-v2/tabs.tsx"
        description="The views of a whole page. An ink bar marks the current one; arrow keys move between them. A dot flags a view with something new. A count is quiet by default; countOf colours it and names what it counts (red for overdue, amber for waiting) so it is never read as the tab total."
      >
        <Tabs
          id="demo-view"
          label="View"
          items={[
            { value: 'for-you', label: 'For you', count: 5, dot: true },
            {
              value: 'board',
              label: 'Board',
              count: 2,
              countOf: { word: 'overdue', tone: 'danger' },
            },
            { value: 'list', label: 'List' },
          ]}
          value={view}
          onChange={setView}
        />
        <p
          role="tabpanel"
          aria-labelledby={tabId('demo-view', view)}
          className="type-body text-zebra-500"
        >
          Showing the {view === 'for-you' ? 'For you' : view === 'board' ? 'Board' : 'List'} view.
        </p>
      </Spec>
      <Spec
        name="Choice card"
        file="components/ui-v2/choice-card.tsx"
        description="A pick that needs a line of explanation. Add check for a multi-select card with a corner mark."
      >
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
            <ChoiceCard
              key={name}
              check
              selected={roles.includes(name)}
              onClick={() =>
                setRoles((r) => (r.includes(name) ? r.filter((x) => x !== name) : [...r, name]))
              }
              className="gap-6"
            >
              <span>
                <span className="block type-label">{name}</span>
                <span className="block type-body text-zebra-500">{line}</span>
              </span>
            </ChoiceCard>
          ))}
        </div>
      </Spec>
      <Spec
        name="Dropdown"
        file="components/ui-v2/dropdown.tsx"
        description="A custom menu, for options shown rather than named (each font in its face), and the pick-one field in a form. In a form it is an option G field: `icon` leads the row and `label` is the grey placeholder until a value is picked, then the value in black with a chevron, the hover tint hugging the words, no label above. The trigger is a button, so it takes the focus mark; the pick is ticked in the selected green. `raised` is the toolbar look beside raised buttons (36px, the panel's corners); `inline` puts the pick inside a sentence; `boxed` is the entry screens' and couple form's field, the name over a white box saying Choose until picked, with help and error under it; `disabled` greys it out."
      >
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <Dropdown
            icon={TypeIcon}
            label="Heading font"
            value={font}
            onChange={setFont}
            options={FONTS}
          />
          <Dropdown raised label="Heading font (raised)" value={font} onChange={setFont} options={FONTS} />
          <Dropdown disabled icon={TypeIcon} label="Heading font (disabled)" value={font} onChange={setFont} options={FONTS} />
          <Dropdown boxed label="Heading font (boxed)" help="Used for titles on proposals." value={font} onChange={setFont} options={FONTS} />
          <Demo label="Inline">
            <p className="flex items-center gap-1 type-body text-zebra-500">
              Recommended for
              <Dropdown
                inline
                label="Role"
                value={role}
                onChange={setRole}
                options={['MC', 'Celebrant', 'DJ'].map((r) => ({ value: r, label: r }))}
              />
            </p>
          </Demo>
        </div>
      </Spec>
      <Spec
        name="Colour field"
        file="components/ui-v2/color-field.tsx"
        description="Opens the app's picker from a swatch beside a hex field (bare, just a round swatch with no label or hex field, for a row that already names it, as a run sheet moment's Colour does); inside a Dialog the picker opens in front of it (it portals into the enclosing dialog, as Dropdown does). `inline` is the settings-row form (the brand kit's Main colour): a small square swatch, the hex and a chevron, the same quiet trigger as an inline Dropdown. `disabled` greys it out."
      >
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <ColorField label="Primary colour" value={colour} onChange={setColour} />
          <ColorField bare label="Block colour" value={colour} onChange={setColour} />
          <ColorField inline label="Main colour" value={colour} onChange={setColour} />
          <ColorField disabled label="Locked colour" value={colour} onChange={setColour} />
        </div>
      </Spec>
      <Spec
        name="File drop"
        file="components/ui-v2/file-drop.tsx"
        description="Takes a file by drag or browse; the hidden native input keeps it a real control, and the box takes the focus mark while it has keyboard focus. `inline` is its compact row with no box (a logo among other controls, as the Style pill's), showing a saved image from `value`; `face` is its tile form, the target being only the picture the caller draws (the brand kit's logo on light and dark), named by a Tooltip."
      >
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <FileDrop label="Logo" accept="image/*" help="PNG or SVG, 512×512 or larger." />
          <FileDrop inline label="Logo" accept="image/*" help="PNG or SVG, on a clear background" />
          <FileDrop label="Logo on dark" accept="image/*" face={<span className="flex size-20 items-center justify-center rounded-button bg-zebra-950 type-body text-zebra-50">Logo</span>} />
          <FileDrop disabled label="Logo (disabled)" accept="image/*" />
        </div>
      </Spec>
      <Spec
        name="Swatch picker"
        file="components/ui-v2/swatch-picker.tsx"
        description="A curated row of round colour swatches to pick one from, with a custom swatch at the end of the label row that opens the full picker. For a choice where the set is the point (brand colours that hold white text) but any colour is allowed. The picked swatch carries a check and a ring, never colour alone."
      >
        <div className="max-w-sm">
          <SwatchPicker
            label="Brand colour"
            swatches={BRAND_COLOURS}
            value={colour}
            onChange={setColour}
          />
        </div>
      </Spec>
      <Spec
        name="Slider"
        file="components/ui-v2/slider.tsx"
        description="A value felt rather than typed (a picture's transparency, a corner's roundness, letter spacing), as the canvas toolbar's cards use it. The label and the current value share a line; the track fills in grass up to the thumb. The browser's own range input, so keys and screen readers work as everywhere. `onCommit` fires when the thumb is let go, so a drag is one undo step."
      >
        <div className="grid max-w-xl gap-6 sm:grid-cols-2">
          <Slider label="Transparency" min={0} max={100} value={opacity} onChange={setOpacity} format={(v) => `${v}%`} />
          <Slider label="Corners" min={0} max={80} value={corners} onChange={setCorners} format={(v) => `${v}px`} />
        </div>
      </Spec>
      <Spec
        name="Rail tab"
        file="components/ui-v2/rail-tab.tsx"
        description="One tab of an editor's tool rail: icon over a one-word name, the open one on the pressed fill; pressing it again folds its panel."
      >
        <div className="flex flex-col gap-1">
          {[{ l: 'Elements', i: ShapesIcon }, { l: 'Text', i: TypeIcon }, { l: 'Uploads', i: UploadIcon }].map(({ l, i }) => (
            <RailTab key={l} icon={i} label={l} active={railTab === l} onClick={() => setRailTab(railTab === l ? null : l)} />
          ))}
        </div>
      </Spec>
      <Spec
        name="Add tile"
        file="components/ui-v2/add-tile.tsx"
        description="Shows what it adds (a shape in the brand colour, a heading in its face); a click adds it to the page in view, a drag places it. Named by a Tooltip, never a native title."
      >
        <div className="flex flex-wrap items-start gap-10">
          <div className="w-56 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <AddTile label="Add a square" onAdd={() => setShapes(shapes + 1)}>
                <span className="size-10 bg-grass-700" />
              </AddTile>
              <AddTile label="Add a circle" onAdd={() => setShapes(shapes + 1)}>
                <span className="size-10 rounded-pill bg-grass-700" />
              </AddTile>
            </div>
            <AddTile shape="row" label="Add a heading" onAdd={() => setShapes(shapes + 1)}>
              <span className="type-heading text-zebra-950">Add a heading</span>
            </AddTile>
            <p className="type-body text-zebra-500">Added {shapes}</p>
          </div>
        </div>
      </Spec>
      <Spec
        name="Corner remove"
        file="components/ui-v2/corner-remove.tsx"
        description="The × on a tile's corner for taking one item out of a set, shown on hover or focus, always on touch, named by a Tooltip."
      >
        <div>
          <ul className="flex gap-3">
            {tiles.map((hex) => (
              <li key={hex} className="group relative">
                <ColorField bare label={hex} value={hex} onChange={() => undefined} />
                <CornerRemove label={`Remove ${hex}`} onClick={() => setTiles(tiles.filter((t) => t !== hex))} />
              </li>
            ))}
          </ul>
        </div>
      </Spec>
      <Spec
        name="Tag list"
        file="components/ui-v2/tag-list.tsx"
        description="Items the user wrote, each removable; adding and removing animate."
      >
        <TagList
          label="What's included"
          items={included}
          onRemove={(item) => setIncluded(included.filter((i) => i !== item))}
          after={
            <Button
              variant="plain"
              onClick={() => setIncluded([...included, `Extra ${included.length + 1}`])}
            >
              <PlusIcon aria-hidden="true" className="size-3.5" />
              Add one
            </Button>
          }
        />
      </Spec>
    </Group>
  );
}
