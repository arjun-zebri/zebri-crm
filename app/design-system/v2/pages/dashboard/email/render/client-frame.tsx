import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';

import { Avatar } from '@/components/ui-v2/avatar';

import { MAILBOX } from '../email-data';

import { clientName, type Client, type Device } from './quirks';

/**
 * The inbox around an email preview, so the MC reads it where the couple
 * will: a desktop window, an iPad or a phone, each with the message
 * header (sender, subject, the preheader and the time) as the inbox
 * shows it; the web version sits in a browser bar with its link. The
 * chrome is plain and neutral, named by its inbox, never a copy of the
 * inbox's own branding. The email itself is `children`.
 *
 * @module app/design-system/v2/pages/dashboard/email/render/client-frame
 */

export interface ClientFrameProps {
  client: Client;
  device: Device;
  subject: string;
  preheader: string;
  children: ReactNode;
}

const WIDTH: Record<Device, string> = {
  desktop: 'max-w-3xl rounded-panel',
  tablet: 'max-w-[34rem] rounded-[1.75rem] border-[10px] border-zebra-900',
  phone: 'max-w-[22rem] rounded-[2.5rem] border-[10px] border-zebra-900',
};

/** The inbox's message header: who it is from, the subject and the preheader. */
function MessageHeader({ subject, preheader, compact }: { subject: string; preheader: string; compact: boolean }) {
  return (
    <div className="space-y-3 border-b border-zebra-950/5 bg-field px-4 py-3">
      <p className={`text-zebra-950 ${compact ? 'type-label' : 'type-subheading'}`}>{subject}</p>
      <div className="flex items-center gap-3">
        <Avatar name={MAILBOX.name} />
        <div className="min-w-0 flex-1 type-body">
          <p className="truncate">
            <span className="type-label text-zebra-950">{MAILBOX.name}</span>
            {compact ? null : <span className="text-zebra-500"> &lt;{MAILBOX.address}&gt;</span>}
          </p>
          <p className="truncate text-zebra-500">to Sarah, Tom · {preheader}</p>
        </div>
        <span className="shrink-0 type-body text-zebra-500">9:41 am</span>
      </div>
    </div>
  );
}

/** The frame. See {@link ClientFrameProps}. */
export function ClientFrame({ client, device, subject, preheader, children }: ClientFrameProps) {
  const web = client === 'web';
  const d = web ? 'desktop' : device;
  return (
    <figure aria-label={`${subject}, as it shows in ${clientName(client)}${web ? '' : ` on ${d === 'desktop' ? 'a computer' : d === 'tablet' ? 'an iPad' : 'a phone'}`}`} className={`mx-auto w-full overflow-hidden bg-zebra-100 shadow-xl ring-1 ring-zebra-950/5 ${WIDTH[d]}`}>
      {d === 'desktop' ? (
        <div className="flex h-9 items-center gap-2 border-b border-zebra-950/5 bg-zebra-100 px-3">
          <span aria-hidden="true" className="flex gap-1.5">
            <span className="size-2.5 rounded-pill bg-zebra-300" />
            <span className="size-2.5 rounded-pill bg-zebra-300" />
            <span className="size-2.5 rounded-pill bg-zebra-300" />
          </span>
          {web ? (
            <span className="mx-auto flex h-6 min-w-0 items-center gap-1.5 rounded-button bg-field px-3 type-body text-zebra-500">
              <Lock aria-hidden="true" strokeWidth={1.5} className="size-3" />
              <span className="truncate">arjunmc.com.au/email/spring-news</span>
            </span>
          ) : (
            <span className="mx-auto type-body text-zebra-500">{clientName(client)} · Inbox</span>
          )}
        </div>
      ) : (
        <div className="flex h-7 items-center justify-between bg-field px-5 type-label text-zebra-950">
          <span>9:41</span>
          <span className="type-body text-zebra-500">{clientName(client)}</span>
        </div>
      )}
      {web ? null : <MessageHeader subject={subject} preheader={preheader} compact={d === 'phone'} />}
      <div className={`overflow-y-auto bg-zebra-50 ${d === 'desktop' ? 'max-h-[40rem] p-6' : 'max-h-[36rem]'}`}>{children}</div>
    </figure>
  );
}
