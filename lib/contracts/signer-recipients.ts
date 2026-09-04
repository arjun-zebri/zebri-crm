/**
 * Grouping contract signers into email recipients.
 *
 * Every client signer holds their OWN capability token (`contract_signers.
 * sign_token`), because a shared link cannot evidence who signed and the first
 * partner to open it would consume the other's signature slot.
 *
 * That creates a delivery problem the send and reminder routes both hit:
 * partners frequently share one inbox. The original code de-duplicated
 * recipients by address, which silently dropped the second partner's link
 * entirely. That partner could never sign, so the contract could never reach
 * `signed` at all. Simply removing the dedup is not the fix either: it sends
 * two near-identical emails carrying different links, and whoever opens the
 * wrong one signs as the wrong person.
 *
 * Grouping by address and naming each link resolves both: one email per
 * mailbox, one clearly-labelled button per signer in it.
 *
 * @module lib/contracts/signer-recipients
 */
import type { SignerLink } from '@/lib/email/html'

/** One signer as the routes load them from `contract_signers`. */
export interface SignerRecipient {
  /** Delivery address; rows without one are dropped by the grouper. */
  email: string | null
  name: string
  /** That signer's personal `sign_token` (or the legacy contract share token). */
  token: string
}

/** All the signers reachable at one address, ready to send to. */
export interface GroupedRecipient {
  /** The address to send to, in its first-seen casing. */
  email: string
  /** Greeting name: the signer, or "Sarah and James" for a shared inbox. */
  name: string
  /** First signer's token. The single-CTA fallback when `links.length === 1`. */
  token: string
  /** One entry per signer at this address, in signing order. */
  links: SignerLink[]
}

/**
 * Join names the way a person would: "Sarah", "Sarah and James",
 * "Sarah, James and Alex".
 */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * Collapse signers into one entry per email address, preserving order.
 *
 * Signers with no address are skipped: the caller decides whether that is a
 * fallback case (use the couple's address) or simply nobody to chase.
 *
 * @param recipients - Signers in signing order.
 * @param urlFor - Builds the public signing URL for a token. Injected so this
 *   module stays free of environment lookups and is trivially testable.
 * @returns One group per distinct address, in first-seen order.
 */
export function groupRecipientsByAddress(
  recipients: readonly SignerRecipient[],
  urlFor: (token: string) => string,
): GroupedRecipient[] {
  const byAddress = new Map<string, GroupedRecipient>()

  for (const r of recipients) {
    if (!r.email) continue
    const key = r.email.toLowerCase()
    const existing = byAddress.get(key)
    const link: SignerLink = { name: r.name, url: urlFor(r.token) }

    if (existing) {
      existing.links.push(link)
      existing.name = joinNames(existing.links.map((l) => l.name))
      continue
    }

    byAddress.set(key, {
      email: r.email,
      name: r.name,
      token: r.token,
      links: [link],
    })
  }

  return [...byAddress.values()]
}
