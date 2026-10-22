import type { JSONContent } from '@tiptap/react';

import { useAccount } from '../account';
import { useBrandKit } from '../brand/brand-provider';
import { DEFAULT_EMAIL, DEFAULT_SIGNATURE } from '../brand/kit';
import { UNNAMED } from '../first-run/use-new-account';
import { MC } from '../proposals/templates-data';

/**
 * The MC's own email signature: the one they write in Settings > Email
 * and, the same one, in any email they are writing (founder, 2026-10-21:
 * written in one place, the email, not picked from a list). Until they
 * write it, it starts from their Business details. Saved to the brand
 * kit, so every email signs off with it.
 *
 * @module app/design-system/v2/pages/dashboard/settings/own-signature
 */

/** A role as a signature says it: "MC", "Celebrant" (the account keeps "celebrant" for the middle of a sentence). */
export const roleTitle = (role: string) => role.charAt(0).toUpperCase() + role.slice(1);

const text = (t: string, marks?: JSONContent['marks']): JSONContent => ({
  type: 'text',
  text: t,
  ...(marks ? { marks } : {}),
});
const para = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content });

/** A first signature from the Business details: name in bold, then role and business, phone, website. The sign-off ("Warmly,") is the email's own, above it. */
export function starterSignature(d: {
  name: string;
  role: string;
  business: string;
  phone: string;
  website: string;
}): JSONContent {
  // An empty text node is not valid TipTap, so a line with nothing in it is left out.
  const lines: JSONContent[] = [];
  if (d.name) lines.push(para(text(d.name, [{ type: 'bold' }])));
  const about = [d.role, d.business].filter(Boolean).join(' · ');
  if (about) lines.push(para(text(about)));
  if (d.phone) lines.push(para(text(d.phone)));
  if (d.website)
    lines.push(
      para(
        text(d.website, [
          {
            type: 'link',
            attrs: { href: d.website.startsWith('http') ? d.website : `https://${d.website}` },
          },
        ]),
      ),
    );
  return { type: 'doc', content: lines };
}

/** The signature as written (or its start) and the way to save a change. */
export function useOwnSignature() {
  const { kit, saveKit } = useBrandKit();
  const { business, mc, contact } = useAccount();
  const mail = kit.email ?? DEFAULT_EMAIL;
  const sig = mail.signature ?? DEFAULT_SIGNATURE;
  const name = kit.details?.name ?? mc?.name ?? MC.name;
  // No name yet (a new account's "You"): an empty signature, so its placeholder asks for theirs, not a lone role.
  const value =
    sig.content ??
    (name === UNNAMED
      ? { type: 'doc', content: [{ type: 'paragraph' }] }
      : starterSignature({
          name,
          role: roleTitle(kit.details?.role ?? mc?.role ?? 'MC'),
          business: kit.details?.business ?? business,
          phone: kit.details?.phone ?? contact?.phone ?? '',
          website: kit.details?.website ?? '',
        }));
  const save = (content: JSONContent) =>
    saveKit({ ...kit, email: { ...mail, signature: { ...sig, content } } });
  return { value, save };
}
