'use client'

/**
 * Print a contract: the same `ContractBrandedCard` the public link renders.
 *
 * @module components/print/print-contract
 */

import type { ReactNode } from 'react'

import { ContractBrandedCard } from '@/app/contract/[token]/_components/contract-branded-card'
import { ContractFallbackCard } from '@/app/contract/[token]/_components/contract-fallback-card'
import { ContractSignSection } from '@/app/contract/[token]/_components/contract-sign-section'
import { deriveState, type PublicContract } from '@/app/contract/[token]/_components/public-contract'
import { repairBlocks } from '@/lib/branding/validate-blocks'
import { buildPrintHtml, printDocument } from '@/lib/pdf/print-document'

/**
 * Compose the printable contract element exactly as `/contract/[token]` does,
 * swapping only the live sign form for its static equivalent.
 */
export function contractPrintElement(
  contract: PublicContract,
  opts: {
    /**
     * The live, interactive sign section. The public page passes this so the
     * couple can actually sign; print and previews omit it and get the same
     * section in print mode (no form). Either way it is the one component.
     */
    signSlot?: ReactNode
  } = {},
) {
  const textColor = contract.text_color || '#111827'
  const mutedColor = contract.muted_color || '#6B7280'
  const brand = contract.brand_color || '#A7F3D0'
  const radius = contract.corner_radius ?? 16
  const headingWeight = contract.font_weight ?? 600
  const pageState = deriveState(contract)

  const repaired =
    contract.branding_blocks && contract.branding_blocks.length > 0
      ? repairBlocks('contract', contract.branding_blocks)
      : null

  // The SAME sign section the page renders, in print mode: countersignature,
  // roster and status banner are pixel-identical because they are the same
  // component. Handlers are no-ops; the live form is suppressed.
  const noop = () => undefined
  const signSlot = opts.signSlot ?? (
    <ContractSignSection
      contract={contract}
      pageState={pageState}
      signerName=""
      onSignerNameChange={noop}
      agreed={false}
      onAgreedChange={noop}
      onSign={noop}
      onDecline={noop}
      actionLoading={false}
      actionError={null}
      onDownloadPdf={noop}
      textColor={textColor}
      mutedColor={mutedColor}
      brand={brand}
      radius={radius}
    />
  )

  return repaired ? (
    <div className="print-card">
      <ContractBrandedCard
        contract={{ ...contract, branding_blocks: repaired }}
        pageState={pageState}
        textColor={textColor}
        mutedColor={mutedColor}
        radius={radius}
        signSlot={signSlot}
      />
    </div>
  ) : (
    <div className="print-card">
      <ContractFallbackCard
        contract={contract}
        pageState={pageState}
        textColor={textColor}
        mutedColor={mutedColor}
        brand={brand}
        radius={radius}
        headingWeight={headingWeight}
        signSlot={signSlot}
      />
    </div>
  )
}

/** The full print document for a contract, for the preview iframe. */
export function buildContractPrintHtml(contract: PublicContract, opts: { canvas?: boolean } = {}): string {
  return buildPrintHtml({
    ...opts,
    title: `Contract ${contract.contract_number}`,
    element: contractPrintElement(contract),
    branding: contract,
  })
}

/** Open the print window for a contract. */
export function printContract(contract: PublicContract): void {
  printDocument({
    title: `Contract ${contract.contract_number}`,
    element: contractPrintElement(contract),
    branding: contract,
  })
}
