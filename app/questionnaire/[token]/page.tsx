/**
 * Public questionnaire page — orchestrator.
 *
 * Reached via the share-token capability URL (`/questionnaire/<token>`).
 * Loads `get_public_questionnaire(token)`, applies the MC's branding to the
 * page chrome, and composes the right state: a loading skeleton, an
 * unavailable card, the one-question-at-a-time flow, or the thank-you state.
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

import { bodyFontFamily, headingFontFamily, useBrandingHead } from '@/lib/branding/public-surface'
import { createClient } from '@/lib/supabase/client'

import { deriveState, type PageState, type PublicQuestionnaire } from './_components/public-questionnaire'
import { QuestionnaireFlow } from './_components/questionnaire-flow'

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

  const pageBg = questionnaire?.surface_color || '#fafafa'
  const textColor = questionnaire?.text_color || '#111827'
  const mutedColor = questionnaire?.muted_color || '#6B7280'
  const brand = questionnaire?.brand_color || '#A7F3D0'
  const radius = questionnaire?.corner_radius ?? 16
  const headingStack = questionnaire ? headingFontFamily(questionnaire) : undefined
  const bodyStack = questionnaire ? bodyFontFamily(questionnaire) : undefined

  return (
    <div className="min-h-screen" style={{ background: pageBg, color: textColor, fontFamily: bodyStack }}>
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-5 py-10">
        {/* Brand header */}
        {questionnaire && pageState !== 'loading' && pageState !== 'not_found' && (
          <div className="mb-10 flex items-center gap-3">
            {questionnaire.logo_url ? (
              // User-uploaded brand asset — no next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={questionnaire.logo_url} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : null}
            <span className="text-sm font-medium" style={{ color: mutedColor }}>
              {questionnaire.business_name || 'Your celebrant'}
            </span>
          </div>
        )}

        <div className="flex flex-1 flex-col justify-center">
          {pageState === 'loading' && (
            <div className="space-y-4">
              <div className="h-1 w-full animate-pulse rounded-full bg-black/10" />
              <div className="h-8 w-2/3 animate-pulse rounded bg-black/10" />
              <div className="h-12 w-full animate-pulse rounded bg-black/10" />
            </div>
          )}

          {pageState === 'not_found' && (
            <div className="text-center">
              <h1 className="mb-2 text-2xl font-semibold" style={{ fontFamily: headingStack }}>
                This link isn&apos;t available
              </h1>
              <p className="text-sm" style={{ color: mutedColor }}>
                The questionnaire may have been closed. Reach out to your celebrant for a fresh link.
              </p>
            </div>
          )}

          {questionnaire && pageState === 'active' && (
            <div>
              <h1 className="mb-8 text-3xl font-semibold" style={{ color: textColor, fontFamily: headingStack }}>
                {questionnaire.title}
              </h1>
              <QuestionnaireFlow
                questionnaire={questionnaire}
                token={params.token}
                brand={brand}
                textColor={textColor}
                mutedColor={mutedColor}
                radius={radius}
                headingStack={headingStack}
                onCompleted={() => setJustCompleted(true)}
              />
            </div>
          )}

          {pageState === 'completed' && (
            <div className="text-center">
              <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full" style={{ background: `${brand}33` }}>
                <span className="text-2xl">✓</span>
              </div>
              <h1 className="mb-2 text-2xl font-semibold" style={{ color: textColor, fontFamily: headingStack }}>
                All done, thank you!
              </h1>
              <p className="text-sm" style={{ color: mutedColor }}>
                Your answers have been sent to {questionnaire?.business_name || 'your celebrant'}.
              </p>
            </div>
          )}
        </div>

        <p className="mt-10 text-center text-xs" style={{ color: mutedColor }}>
          Secured by Zebri ·{' '}
          <a href="https://zebri.com.au" className="hover:opacity-70">
            zebri.com.au
          </a>
        </p>
      </div>
    </div>
  )
}
