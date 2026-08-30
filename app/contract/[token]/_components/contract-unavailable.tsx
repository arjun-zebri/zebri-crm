/**
 * Card shown when the share token is invalid, the contract has been
 * revoked, or the public-token-limiter has tripped (we render the
 * same surface in all three cases — never leak the rate-limit state).
 *
 * @module app/contract/[token]/_components/contract-unavailable
 */
export interface ContractUnavailableProps {
  radius: number;
  textColor: string;
  mutedColor: string;
}

export function ContractUnavailable({
  radius,
  textColor,
  mutedColor,
}: ContractUnavailableProps) {
  return (
    <div
      className="bg-surface shadow-sm border border-border p-10 text-center"
      style={{ borderRadius: radius }}
    >
      <p
        className="text-sm font-medium mb-1"
        style={{ color: textColor }}
      >
        Contract unavailable
      </p>
      <p className="text-sm" style={{ color: mutedColor }}>
        This link may be invalid or has been revoked. Please contact the
        person who sent it to you.
      </p>
    </div>
  );
}
