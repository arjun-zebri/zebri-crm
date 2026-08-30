import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ContractSignersList } from '@/app/contract/[token]/_components/contract-signers-list'
import {
  outstandingSigners,
  viewerSigner,
  type ContractSigner,
  type PublicContract,
} from '@/app/contract/[token]/_components/public-contract'
import { makeBranding } from '@/tests/unit/branding/helpers'

const signer = (over: Partial<ContractSigner> & { id: string; name: string }): ContractSigner => ({
  role: 'client',
  signing_order: 1,
  required: true,
  signed_at: null,
  declined_at: null,
  ...over,
})

const contractWith = (
  signers: ContractSigner[],
  viewerId: string | null,
): PublicContract =>
  ({
    ...makeBranding(),
    id: 'c1',
    title: 'Agreement',
    contract_number: 'CTR-1',
    status: 'sent',
    locked_content_html: '<p>Terms</p>',
    expires_at: null,
    signed_at: null,
    signer_name: null,
    signer_ip: null,
    signer_user_agent: null,
    declined_at: null,
    declined_reason: null,
    mc_signature_name: null,
    email_sent_at: null,
    couple_name: 'Sam and Alex',
    event_date: null,
    venue: null,
    branding_blocks: null,
    signers,
    viewer_signer_id: viewerId,
  }) as unknown as PublicContract

const sam = signer({ id: 's1', name: 'Sam Rivera', signing_order: 1 })
const alex = signer({ id: 's2', name: 'Alex Rivera', signing_order: 2 })

describe('viewerSigner', () => {
  it('finds the signer whose link was opened', () => {
    expect(viewerSigner(contractWith([sam, alex], 's2'))?.name).toBe('Alex Rivera')
  })

  it('returns null on a legacy share link', () => {
    expect(viewerSigner(contractWith([sam, alex], null))).toBeNull()
  })
})

describe('outstandingSigners', () => {
  it('lists other required signers who have not signed', () => {
    const c = contractWith([{ ...sam, signed_at: '2027-01-01T00:00:00Z' }, alex], 's1')
    expect(outstandingSigners(c).map((s) => s.name)).toEqual(['Alex Rivera'])
  })

  it('never includes the viewer themselves', () => {
    expect(outstandingSigners(contractWith([sam, alex], 's1')).map((s) => s.name)).toEqual([
      'Alex Rivera',
    ])
  })

  it('ignores optional signers and anyone who declined', () => {
    const c = contractWith(
      [sam, { ...alex, required: false }, signer({ id: 's3', name: 'Jo', declined_at: 'x' })],
      's1',
    )
    expect(outstandingSigners(c)).toEqual([])
  })
})

describe('ContractSignersList', () => {
  it('shows each party and marks the viewer', () => {
    render(
      <ContractSignersList
        contract={contractWith([{ ...sam, signed_at: '2027-03-14T00:00:00Z' }, alex], 's1')}
        textColor="#111"
        mutedColor="#666"
      />,
    )
    expect(screen.getByText(/Sam Rivera \(you\)/)).toBeTruthy()
    expect(screen.getByText('Alex Rivera')).toBeTruthy()
    expect(screen.getByText(/Awaiting signature/)).toBeTruthy()
  })

  it('renders nothing when there is only one signer', () => {
    const { container } = render(
      <ContractSignersList
        contract={contractWith([sam], 's1')}
        textColor="#111"
        mutedColor="#666"
      />,
    )
    expect(container.firstChild).toBeNull()
  })
})
