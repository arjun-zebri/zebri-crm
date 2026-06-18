/**
 * Templates page (server orchestrator).
 *
 * Seeds the MC's starter library on first visit, then hands off to the
 * client orchestrator. Auth is enforced by middleware; we read the
 * business / contact name from user metadata to personalise the
 * library preview's sign-off.
 *
 * @module app/(dashboard)/templates/page
 */
import { redirect } from 'next/navigation'

import { ensureStarterTemplates } from '@/lib/email/starter-templates'
import { createClient } from '@/lib/supabase/server'

import { TemplatesClient } from './templates-client'

export default async function TemplatesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await ensureStarterTemplates(supabase, user.id)

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  return (
    <TemplatesClient
      businessName={meta['business_name'] as string | undefined}
      contactName={meta['display_name'] as string | undefined}
    />
  )
}
