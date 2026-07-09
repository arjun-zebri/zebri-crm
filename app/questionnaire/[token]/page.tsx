/**
 * Public questionnaire page — orchestrator.
 *
 * Reached via the share-token capability URL (`/questionnaire/<token>`).
 * Loads `get_public_questionnaire(token)`, applies the MC's branding to the
 * page chrome, and composes the right state: a loading skeleton, an
 * unavailable card, the fill experience (one-question-at-a-time or classic
 * form, per the questionnaire's display mode), or the thank-you state.
 *
 * Auth model: unauthenticated. The share token IS the capability; the RPC
 * validates it against `share_token_enabled = true`.
 *
 * @module app/questionnaire/[token]/page
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { useState } from 'react'

import { themeFromBranding } from '@/components/questionnaires/theme'
import { useBrandingHead } from '@/lib/branding/public-surface'
import { createClient } from '@/lib/supabase/client'

import { FillSection } from './_components/fill-section'
import { deriveState, type PageState, type PublicQuestionnaire } from './_components/public-questionnaire'

export default function PublicQuestionnairePage() {
  const params = useParams<{ token: string }>()
  const supabase = createClient()
  // Set once the couple submits, for an instant thank-you without waiting on a
  // refetch round-trip.
  const [justCompleted, setJustCompleted] = useState(false)

  const { data: questionnaire = null, isPending } = useQuery({
    queryKey: ['public-questionnaire', params.token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_questionnaire', { token: params.token })
      if (error) throw error
      return (data as unknown as PublicQuestionnaire) ?? null
    },
    retry: false,
  })

  const pageState: PageState = justCompleted
    ? 'completed'
    : isPending
      ? 'loading'
      : deriveState(questionnaire)

  useBrandingHead(questionnaire)

  const theme = themeFromBranding(questionnaire)

  return (
    <div className="min-h-screen" style={{ background: theme.pageBg, color: theme.textColor, fontFamily: theme.bodyStack }}>
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-5 py-10">
        {/* Brand header */}
        {questionnaire && pageState !== 'loading' && pageState !== 'not_found' && (
          <div className="mb-10 flex items-center gap-3">
            {theme.logoUrl ? (
              // User-uploaded brand asset — no next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={theme.logoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : null}
            <span className="text-sm font-medium" style={{ color: theme.mutedColor }}>
              {theme.businessName}
            </span>
          </div>
        )}

        {/* Loading / unavailable / thank-you states centre in the viewport.
            The active fill flow is top-anchored instead: centring would
            re-centre on every question, so steps of different heights make
            the whole page jump between Next clicks. */}
        <div className={`flex flex-1 flex-col ${pageState === 'active' ? '' : 'justify-center'}`}>
          {pageState === 'loading' && (
            <div className="space-y-4">
              <div className="h-1 w-full animate-pulse rounded-full bg-black/10" />
              <div className="h-8 w-2/3 animate-pulse rounded bg-black/10" />
              <div className="h-12 w-full animate-pulse rounded bg-black/10" />
            </div>
          )}

          {pageState === 'not_found' && (
            <div className="text-center">
              <h1 className="mb-2 text-2xl font-semibold" style={{ fontFamily: theme.headingStack }}>
                This link isn&apos;t available
              </h1>
              <p className="text-sm" style={{ color: theme.mutedColor }}>
                The questionnaire may have been closed. Reach out to your celebrant for a fresh link.
              </p>
            </div>
          )}

          {questionnaire && pageState === 'active' && (
            <FillSection
              questionnaire={questionnaire}
              token={params.token}
              theme={theme}
              onCompleted={() => setJustCompleted(true)}
            />
          )}

          {pageState === 'completed' && (
            <div className="text-center">
              <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full" style={{ background: `${theme.brand}33` }}>
                <span className="text-2xl">✓</span>
              </div>
              <h1 className="mb-2 text-2xl font-semibold" style={{ color: theme.textColor, fontFamily: theme.headingStack }}>
                All done, thank you!
              </h1>
              <p className="text-sm" style={{ color: theme.mutedColor }}>
                Your answers have been sent to {theme.businessName}. They&apos;ll be in touch soon.
              </p>
            </div>
          )}
        </div>

        <p className="mt-10 text-center text-xs" style={{ color: theme.mutedColor }}>
          Secured by Zebri ·{' '}
          <a href="https://zebri.com.au" className="hover:opacity-70">
            zebri.com.au
          </a>
        </p>
      </div>
    </div>
  )
}
