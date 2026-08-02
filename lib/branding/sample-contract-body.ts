/**
 * Sample contract-body content shared by the branding editor's contract-body
 * placeholder and the branding preview page. Generic wedding-MC terms — this is
 * never sent; the couple's real per-couple body replaces it on the document. A
 * single source keeps the builder and the preview showing the same mock.
 *
 * @module lib/branding/sample-contract-body
 */

/** One numbered clause: a subheading and its paragraph. */
export interface SampleContractClause {
  /** Subheading line (e.g. "1. Services"). */
  heading: string
  /** Paragraph body under the subheading. */
  body: string
}

/** The sample clauses rendered in the contract-body mock. */
export const SAMPLE_CONTRACT_CLAUSES: SampleContractClause[] = [
  {
    heading: '1. Services',
    body: "The MC will host and coordinate the wedding reception described above: welcoming guests, running the formalities, and working with the couple's vendors to keep the evening on schedule.",
  },
  {
    heading: '2. Fees and payment',
    body: 'The total fee is set out in the accompanying invoice. A deposit secures the date and the balance is due before the event. Amounts paid are non-refundable once the date is reserved.',
  },
  {
    heading: '3. Cancellation',
    body: 'If the couple cancels, the deposit is retained to cover the reserved date. Cancellations within four weeks of the event may incur the full fee.',
  },
]
