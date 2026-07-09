/**
 * Templates page (server orchestrator).
 *
 * Hands off to the client orchestrator. Auth is enforced by middleware;
 * we read the business / contact name from user metadata to personalise
 * the library preview's sign-off. Nothing is auto-seeded — MCs add
 * starters from the in-app "Browse starter templates" catalog.
 *
 * @module app/(dashboard)/templates/page
 */
import type { JSONContent } from '@tiptap/react'
import { redirect } from 'next/navigation'

import { buildPublicBranding, type UserMetadata } from '@/lib/branding/public-branding'
import { createClient } from '@/lib/supabase/server'

import { TemplatesClient } from './templates-client'

export default async function TemplatesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // No auto-seeding — MCs add starters from the "Browse starter
  // templates" catalog on the Emails tab.
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  return (
    <TemplatesClient
      businessName={meta['business_name'] as string | undefined}
      contactName={meta['display_name'] as string | undefined}
      email={user.email}
      emailSignature={(meta['email_signature'] as JSONContent | undefined) ?? null}
      branding={buildPublicBranding(meta as UserMetadata)}
    />
  )
}
