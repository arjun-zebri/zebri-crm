/**
 * Unit tests for ContractSignatureDisplay — pure-presentation
 * signed / declined card surfaced when a contract is in a terminal
 * state.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ContractSignatureDisplay } from '@/components/builders/parts/contract-signature-display';

describe('ContractSignatureDisplay', () => {
  describe('kind = "signed"', () => {
    it('renders the signer name + formatted date', () => {
      render(
        <ContractSignatureDisplay
          kind="signed"
          signerName="Anna Park"
          signedAt="2026-05-15T10:00:00Z"
          signerIp="203.0.113.42"
          declinedReason={null}
        />,
      );
      expect(screen.getByText(/Anna Park/)).toBeInTheDocument();
      expect(screen.getByText(/15 May 2026/)).toBeInTheDocument();
    });

    it('renders the IP block when present', () => {
      render(
        <ContractSignatureDisplay
          kind="signed"
          signerName="Anna"
          signedAt="2026-05-15T10:00:00Z"
          signerIp="203.0.113.42"
          declinedReason={null}
        />,
      );
      expect(screen.getByText(/203\.0\.113\.42/)).toBeInTheDocument();
    });

    it('omits the IP block when signerIp is null', () => {
      render(
        <ContractSignatureDisplay
          kind="signed"
          signerName="Anna"
          signedAt="2026-05-15T10:00:00Z"
          signerIp={null}
          declinedReason={null}
        />,
      );
      expect(screen.queryByText(/From IP/)).not.toBeInTheDocument();
    });

    it('falls back to "the couple" when signerName is null', () => {
      render(
        <ContractSignatureDisplay
          kind="signed"
          signerName={null}
          signedAt="2026-05-15T10:00:00Z"
          signerIp={null}
          declinedReason={null}
        />,
      );
      expect(screen.getByText(/the couple/i)).toBeInTheDocument();
    });
  });

  describe('kind = "declined"', () => {
    it('renders the Declined header', () => {
      render(
        <ContractSignatureDisplay
          kind="declined"
          signerName={null}
          signedAt={null}
          signerIp={null}
          declinedReason={null}
        />,
      );
      expect(screen.getByText(/^Declined$/)).toBeInTheDocument();
    });

    it('renders the reason when present', () => {
      render(
        <ContractSignatureDisplay
          kind="declined"
          signerName={null}
          signedAt={null}
          signerIp={null}
          declinedReason="Changed our mind"
        />,
      );
      expect(screen.getByText(/Changed our mind/)).toBeInTheDocument();
    });

    it('omits the reason block when null', () => {
      render(
        <ContractSignatureDisplay
          kind="declined"
          signerName={null}
          signedAt={null}
          signerIp={null}
          declinedReason={null}
        />,
      );
      expect(screen.queryByText(/Reason:/i)).not.toBeInTheDocument();
    });
  });
});
