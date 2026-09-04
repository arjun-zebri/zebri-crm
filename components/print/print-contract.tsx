'use client'

/**
 * Print a contract: the same `ContractBrandedCard` the public link renders.
 *
 * @module components/print/print-contract
 */

import type { ReactNode } from 'react'

import { ContractBrandedCard } from '@/app/contract/[token]/_components/contract-branded-card'
import { ContractCertificate } from '@/app/contract/[token]/_components/contract-certificate'
import { ContractFallbackCard } from '@/app/contract/[token]/_components/contract-fallback-card'
import { type SignParty } from '@/app/contract/[token]/_components/contract-parties'
import { partyBlockFrom } from '@/app/contract/[token]/_components/contract-party-block'
import { ContractSignParty } from '@/app/contract/[token]/_components/contract-sign-party'
import { ContractSignSection } from '@/app/contract/[token]/_components/contract-sign-section'
import { ContractStatusSlot } from '@/app/contract/[token]/_components/contract-status-slot'
import { deriveState, type PublicContract } from '@/app/contract/[token]/_components/public-contract'
import { SIGNATURE_FONT_GOOGLE_FAMILY } from '@/lib/branding/signature-font'
import { repairBlocks } from '@/lib/branding/validate-blocks'
import { DEFAULT_VENDOR_ROLE } from '@/lib/branding/vendor-role'
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
    /**
     * The live per-party signature slot, for a tree using the three per-party
     * blocks. Omitted for print and previews, which get the same panels in
     * static form (no sign form) from the same components.
     */
    signSlotFor?: (party: SignParty) => ReactNode
    /**
     * Document-level status banner. The live page passes one whose PDF button
     * works; print passes none and gets the static default below.
     */
    statusBanner?: ReactNode
    /**
     * Append the certificate of completion. True for print and the PDF, where
     * the trail is the evidence the document carries. The couple-facing page
     * turns it off: the person who just signed does not need their own audit
     * log on screen, and it is the last thing they should have to scroll past.
     */
    certificate?: boolean
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
      signatureMode="typed"
      onSignatureModeChange={noop}
      drawnImage={null}
      onDrawnImageChange={noop}
      textColor={textColor}
      mutedColor={mutedColor}
      brand={brand}
      radius={radius}
    />
  )

  // Static per-party panels for print / preview: the same components the live
  // page uses, with no-op handlers, so the printed signature page is the one
  // the couple saw. `showForm` is false throughout because a printed document
  // has nothing to submit.
  const vendorRole = contract.vendor_role || DEFAULT_VENDOR_ROLE
  const signSlotFor =
    opts.signSlotFor ??
    ((party: SignParty) => (
      <ContractSignParty
        contract={contract}
        party={party}
        vendorRole={vendorRole}
        textColor={textColor}
        mutedColor={mutedColor}
        {...(partyBlockFrom(repaired, party) ? { block: partyBlockFrom(repaired, party)! } : {})}
      />
    ))

  // The certificate follows the card on every completed contract. Rendered
  // here rather than as a branding block: an interested party must not be able
  // to restyle, reorder or delete their own evidence.
  const certificate = (opts.certificate ?? true) ? (
    <ContractCertificate
      contract={contract}
      textColor={textColor}
      mutedColor={mutedColor}
      radius={radius}
    />
  ) : null

  return repaired ? (
    <div className="print-card">
      <ContractBrandedCard
        contract={{ ...contract, branding_blocks: repaired }}
        pageState={pageState}
        textColor={textColor}
        mutedColor={mutedColor}
        radius={radius}
        signSlot={signSlot}
        signSlotFor={signSlotFor}
        statusBanner={
          opts.statusBanner ?? (
            <ContractStatusSlot contract={contract} pageState={pageState} />
          )
        }
      />
      {certificate}
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
      {certificate}
    </div>
  )
}

/**
 * Fonts the contract document needs beyond the MC's brand pair.
 *
 * The signature face is self-hosted in the app shell but the print window is a
 * separate document that never sees it, so it is requested explicitly here.
 * Without this the signature prints in a generic cursive fallback.
 */
const CONTRACT_PRINT_FONTS = [SIGNATURE_FONT_GOOGLE_FAMILY]

/** The full print document for a contract, for the preview iframe. */
export function buildContractPrintHtml(contract: PublicContract, opts: { canvas?: boolean } = {}): string {
  return buildPrintHtml({
    ...opts,
    // Same shell config as printContract, so what the preview shows and what
    // prints carry the same page box.
    bare: true,
    title: `Contract ${contract.contract_number}`,
    element: contractPrintElement(contract),
    branding: contract,
    extraFontFamilies: CONTRACT_PRINT_FONTS,
  })
}

/** Open the print window for a contract. */
export function printContract(contract: PublicContract): void {
  printDocument({
    // Browsers paint their own header and footer (date, document title,
    // `about:blank`, page numbers) in the @page margin. A contract is a legal
    // document that must print as the couple saw it, so the margin goes to
    // zero and the same 14mm comes back as body padding.
    bare: true,
    title: `Contract ${contract.contract_number}`,
    element: contractPrintElement(contract),
    branding: contract,
    extraFontFamilies: CONTRACT_PRINT_FONTS,
  })
}
