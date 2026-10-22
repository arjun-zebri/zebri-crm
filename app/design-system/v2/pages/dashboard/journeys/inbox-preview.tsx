'use client';

import type { ReactNode } from 'react';

import { StyleScope, useDocumentStyle } from '../brand/use-document-style';
import { EmailBody } from '../email/render/email-body';
import type { Device } from '../email/render/quirks';

import { DEVICE_WIDTH, DeviceControls } from './email-editor/device-controls';
import { docToBlocks } from './email-editor/email-doc';
import { docOf, filled } from './step-email';
import type { StepEmail } from './step-settings';

/**
 * One of a step's emails as the client gets it: `DeviceControls` (which
 * screen), the lines an inbox shows before it is opened
 * (who it is to, the subject, when it goes), then the email card exactly
 * as `EmailBody` sends it, in the MC's branding, at that screen's width.
 * The same card and lines as the email builder, so reading an email and
 * writing one look alike. No inbox chrome or inbox picker (founder,
 * 2026-10-20): the email is the thing. `{field}`s read as the sample
 * couple's. The email builder's Preview is this too.
 *
 * The step dialog holds the view (`PreviewView`), so the device stays as
 * picked from one tab to the next.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/inbox-preview
 */

/** Which screen the preview shows. */
export interface PreviewView {
  device: Device;
}

/** Where a preview starts: a computer. */
export const START_VIEW: PreviewView = { device: 'desktop' };

export interface InboxPreviewProps {
  email: StepEmail;
  /** When it goes: "Straight away", "3 days later"; no Sends line when left out (a template goes when it is used). */
  when?: string | undefined;
  /** The one thing a drafted email asks them to do, as its closing button. */
  button?: string | null | undefined;
  /** Who it goes to; the sample couple when unset. */
  to?: string | undefined;
  view: PreviewView;
  onView: (view: PreviewView) => void;
}

/** A line above the email: its name on the left in a fixed column, as in the builder. */
function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center gap-4 type-body">
      <span className="w-24 shrink-0 text-zebra-500">{label}</span>
      <span className="min-w-0 truncate text-zebra-950">{children}</span>
    </div>
  );
}

/** The preview. See {@link InboxPreviewProps}. */
export function InboxPreview({ email, when, button, to, view, onView }: InboxPreviewProps) {
  const style = useDocumentStyle('email');
  const blocks = docToBlocks(docOf(email, button));
  const narrow = view.device === 'phone';
  return (
    <div className={`mx-auto space-y-6 transition-[max-width] duration-150 ease-out motion-reduce:transition-none ${DEVICE_WIDTH[view.device]}`}>
      <DeviceControls device={view.device} onDevice={(device) => onView({ ...view, device })} />
      <div className="space-y-0.5">
        <Line label="To">{to ?? filled('{first names}')}</Line>
        <Line label="Subject">{filled(email.subject)}</Line>
        {when ? <Line label="Sends">{when}</Line> : null}
      </div>
      <StyleScope style={style}>
        {/* The card the builder draws: the brand's paper, a hairline edge. */}
        <article className="overflow-hidden rounded-panel ring-1 ring-hairline">
          <EmailBody
            blocks={blocks}
            signature={email.signature ?? 'full'}
            signOff={email.signOff}
            header={email.header}
            quirks={{ webFonts: true, squareCorners: false, clipped: false, narrow }}
            chrome={false}
          />
        </article>
      </StyleScope>
    </div>
  );
}
