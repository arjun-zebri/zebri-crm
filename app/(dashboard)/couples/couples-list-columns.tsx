/**
 * `@tanstack/react-table` column definitions for the couples list.
 *
 * One column factory keyed on the user's customisable
 * `couple_statuses` records (the Status column needs them to
 * resolve `slug` → display name + colour). Extracted from
 * `couples-list.tsx` so the table file stays composition-only.
 *
 * Sort + filter are controlled by the parent (`useCouplesView()`
 * hook) — we declare `enableSorting: false` here because the
 * header click is wired to that hook, not to react-table.
 *
 * @module app/(dashboard)/couples/couples-list-columns
 */
import { createColumnHelper } from '@tanstack/react-table';
import { Calendar, ListChecks, Mail, MapPin, Phone } from 'lucide-react';

import { formatDate } from '@/lib/utils';
import { Couple, CoupleStatusRecord, getStatusClasses } from '@/types/couple';

const columnHelper = createColumnHelper<Couple>();

/** Per-column width percentages (total = 100%). */
export const COL_WIDTHS: Record<string, string> = {
  name: '25%',
  email: '23%',
  phone: '13%',
  event_date: '12%',
  venue: '17%',
  status: '10%',
};

interface HeaderLabelProps {
  icon?: React.ReactNode;
  label: string;
  textOnly?: string;
}

function HeaderLabel({ icon, label, textOnly }: HeaderLabelProps) {
  return (
    <span className="flex items-center gap-1.5">
      {textOnly ? <span className="text-[11px]">{textOnly}</span> : icon}
      {label}
    </span>
  );
}

export function createCouplesListColumns(statuses: CoupleStatusRecord[]) {
  return [
    columnHelper.accessor('name', {
      header: () => <HeaderLabel textOnly="Aa" label="Name" />,
      enableSorting: false,
      cell: (info) => (
        <span className="text-sm text-gray-500 group-hover:text-gray-900 truncate block">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('email', {
      header: () => (
        <HeaderLabel
          icon={<Mail size={12} strokeWidth={1.5} />}
          label="Email"
        />
      ),
      enableSorting: false,
      meta: { hidden: 'hidden sm:table-cell' },
      cell: (info) => (
        <span className="text-sm text-gray-500 group-hover:text-gray-900 truncate block">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('phone', {
      header: () => (
        <HeaderLabel
          icon={<Phone size={12} strokeWidth={1.5} />}
          label="Phone"
        />
      ),
      enableSorting: false,
      meta: { hidden: 'hidden lg:table-cell' },
      cell: (info) => (
        <span className="text-sm text-gray-500 group-hover:text-gray-900">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('event_date', {
      header: () => (
        <HeaderLabel
          icon={<Calendar size={12} strokeWidth={1.5} />}
          label="Event date"
        />
      ),
      enableSorting: false,
      meta: { hidden: 'hidden sm:table-cell' },
      cell: (info) => (
        <span className="text-sm text-gray-500 group-hover:text-gray-900">
          {formatDate(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor('venue', {
      header: () => (
        <HeaderLabel
          icon={<MapPin size={12} strokeWidth={1.5} />}
          label="Venue"
        />
      ),
      enableSorting: false,
      meta: { hidden: 'hidden lg:table-cell' },
      cell: (info) => (
        <span className="text-sm text-gray-500 group-hover:text-gray-900 truncate block">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('status', {
      header: () => (
        <HeaderLabel
          icon={<ListChecks size={12} strokeWidth={1.5} />}
          label="Status"
        />
      ),
      enableSorting: false,
      cell: (info) => {
        const statusSlug = info.getValue();
        const status = statuses.find((s) => s.slug === statusSlug);
        const classes = status
          ? getStatusClasses(status.color)
          : getStatusClasses('gray');
        const statusName =
          status?.name ||
          statusSlug.charAt(0).toUpperCase() + statusSlug.slice(1);
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${classes.pill}`}
          >
            {statusName}
          </span>
        );
      },
    }),
  ];
}
