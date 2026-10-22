import { GroupLabel } from '@/components/ui-v2/group-label';

import type { Block } from './catalog';

/**
 * "Connects to" on a block's detail: the services it plugs into (Stripe,
 * Google Calendar, Outlook), each in its brand's own colour, and that
 * any one will do. Plain marks and names on one line, not chips: there
 * is nothing to press here, because connecting is the first thing the
 * block's own page asks for once it is added. Nothing shows for a block
 * that needs no service.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/connects-to
 */
export function ConnectsTo({ block }: { block: Block }) {
  const services = block.connects ?? [];
  if (services.length === 0) return null;
  return (
    <section aria-labelledby="connects-to" className="space-y-2">
      <GroupLabel as="h4" id="connects-to">
        {services.length > 1 ? 'Connects to either' : 'Connects to'}
      </GroupLabel>
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {services.map(({ name, icon: Icon, color }) => (
          <li key={name} className="flex items-center gap-2 type-label text-zebra-950">
            {/* The brand's own colour, so it is the icon's `color`, not a token. */}
            <Icon aria-hidden color={color} className="size-4 shrink-0" />
            {name}
          </li>
        ))}
      </ul>
    </section>
  );
}
