/**
 * The event table on the certificate of completion.
 *
 * Split from `contract-certificate` purely for size; the two are always
 * rendered together.
 *
 * IPs arrive already prefixed from `get_public_contract`: the redaction is a
 * privacy boundary and belongs in SQL, not here. This only formats.
 *
 * @module app/contract/[token]/_components/contract-certificate-events
 */
import { FONT_STACKS } from '@/lib/branding/fonts';
import { roleDefaults } from '@/lib/branding/type-defaults';
import { describeEvent, type AuditTrailEvent } from '@/lib/contracts/audit-trail';
import { describeUserAgent } from '@/lib/contracts/user-agent';

import { formatDateTime, type PublicContract } from './public-contract';

export interface ContractCertificateEventsProps {
  contract: PublicContract;
  events: AuditTrailEvent[];
  vendorRole: string;
  textColor: string;
  mutedColor: string;
}

export function ContractCertificateEvents({
  contract,
  events,
  vendorRole,
  textColor,
  mutedColor,
}: ContractCertificateEventsProps) {
  const bodyDefaults = roleDefaults(contract, 'body');
  const fineDefaults = roleDefaults(contract, 'finePrint');

  const bodyStyle = {
    color: textColor,
    fontSize: `${bodyDefaults.fontSize}px`,
    fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
    lineHeight: bodyDefaults.lineHeight,
  };
  const fineStyle = {
    color: mutedColor,
    fontSize: `${fineDefaults.fontSize}px`,
    fontFamily: FONT_STACKS[fineDefaults.fontFamily as never],
    lineHeight: fineDefaults.lineHeight,
  };

  return (
    // Scrolls rather than overflowing the card on a phone; a certificate that
    // pushes the page sideways is unreadable exactly where it is most likely
    // to be opened.
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left pb-2 pr-4" style={fineStyle}>
              Event
            </th>
            <th className="text-left pb-2 pr-4" style={fineStyle}>
              When
            </th>
            <th className="text-left pb-2" style={fineStyle}>
              Origin
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((event, i) => {
            const agent = describeUserAgent(event.actor_user_agent);
            return (
              <tr
                key={`${event.event_type}-${event.event_at}-${String(i)}`}
                className="border-t"
                style={{ borderTopColor: contract.border_color }}
              >
                <td className="py-2 pr-4 align-top" style={bodyStyle}>
                  {describeEvent(event, vendorRole)}
                </td>
                <td className="py-2 pr-4 align-top whitespace-nowrap" style={fineStyle}>
                  {formatDateTime(event.event_at)}
                </td>
                <td className="py-2 align-top" style={fineStyle}>
                  {event.actor_ip_prefix ?? 'Not recorded'}
                  {agent ? (
                    <span className="block">{agent}</span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
