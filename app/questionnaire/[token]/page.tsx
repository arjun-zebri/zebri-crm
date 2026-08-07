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
import { DOC_MAX_WIDTH_PX } from '@/lib/branding/document-frame'
import { PublicBlockRenderer, type PublicDocData } from '@/lib/branding/public-renderer'
import { useBrandingHead } from '@/lib/branding/public-surface'
import { repairBlocks } from '@/lib/branding/validate-blocks'
import { createClient } from '@/lib/supabase/client'

import { FillSection } from './_components/fill-section'
import { deriveState, type PageState, type PublicQuestionnaire } from './_components/public-questionnaire'
import { questionnaireChrome } from './_lib/branding-chrome'

/** Empty doc data for rendering pre/post blocks in questionnaire. */
const QUESTIONNAIRE_DOC: PublicDocData = {
  title: '',
  refNumber: '',
  expiresAt: null,
  items: [],
  subtotal: 0,
  taxRate: 0,
}

/** Generate a translucent tint of a hex colour for skeleton backgrounds. */
function skeletonBg(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match?.[1]) return '#00000010'
  return `${match[0]}10`
}

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

  // Parse and split branding blocks around the marker.
  const allBlocks = questionnaire?.branding_blocks && questionnaire.branding_blocks.length > 0
    ? repairBlocks('questionnaire', questionnaire.branding_blocks)
    : []
  // The form style is chosen by which of the two form-style blocks is present.
  // Safe fallback for the invalid states the editor warns about: if both are
  // present, the first in the tree wins; if none is present, fall back to the
  // classic all-on-one-page form so the couple always has something to fill.
  const formBlock = allBlocks.find(
    (b) => b.type === 'questionnaireOneAtATime' || b.type === 'questionnaireAllOnePage',
  )
  const displayMode: 'form' | 'oneAtATime' =
    formBlock?.type === 'questionnaireOneAtATime' ? 'oneAtATime' : 'form'
  const chrome = questionnaireChrome(allBlocks, displayMode)

  return (
    <div className="min-h-screen" style={{ background: theme.pageBg, color: theme.textColor, fontFamily: theme.bodyStack }}>
      <div className="mx-auto flex min-h-screen w-full flex-col px-5 py-10" style={{ maxWidth: DOC_MAX_WIDTH_PX }}>
        {/* Brand header: only render if no businessName block in the tree. */}
        {questionnaire && pageState !== 'loading' && pageState !== 'not_found' && !chrome.hasBusinessName && (
          <div className="mb-10 flex items-center gap-3">
            {theme.logoUrl ? (
              // User-uploaded brand asset — no next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={theme.logoUrl} alt="" className="h-9 w-9 rounded-pill object-cover" />
            ) : null}
            <span style={{ fontSize: `${theme.bodyFontSize}px`, fontWeight: 500, color: theme.mutedColor }}>
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
              <div className="h-1 w-full animate-pulse rounded-pill" style={{ backgroundColor: skeletonBg(questionnaire?.border_color ?? '#111827') }} />
              <div className="h-8 w-2/3 animate-pulse rounded-control" style={{ backgroundColor: skeletonBg(questionnaire?.border_color ?? '#111827') }} />
              <div className="h-12 w-full animate-pulse rounded-control" style={{ backgroundColor: skeletonBg(questionnaire?.border_color ?? '#111827') }} />
            </div>
          )}

          {pageState === 'not_found' && (
            <div className="text-center">
              <h1 className="mb-2 font-semibold" style={{ fontSize: `${theme.headingFontSize}px`, color: theme.headingColor, fontFamily: theme.headingStack }}>
                This link isn&apos;t available
              </h1>
              <p style={{ fontSize: `${theme.bodyFontSize}px`, color: theme.mutedColor }}>
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
              preBlocks={chrome.preBlocks}
              postBlocks={chrome.postBlocks}
              showWelcome={chrome.showWelcome}
              displayMode={displayMode}
              {...(formBlock ? { formBlock } : {})}
            />
          )}

          {pageState === 'completed' && (
            <>
              <div className="text-center">
                <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-pill" style={{ background: `${theme.brand}33` }}>
                  <span style={{ fontSize: `${theme.headingFontSize}px` }}>✓</span>
                </div>
                <h1 className="mb-2 font-semibold" style={{ fontSize: `${theme.headingFontSize}px`, color: theme.headingColor, fontFamily: theme.headingStack }}>
                  All done, thank you!
                </h1>
                <p style={{ fontSize: `${theme.bodyFontSize}px`, color: theme.mutedColor }}>
                  Your answers have been sent to {theme.businessName}. They&apos;ll be in touch soon.
                </p>
              </div>
              {chrome.postBlocks.length > 0 && questionnaire && (
                <div className="mt-10 pt-6 border-t" style={{ borderColor: theme.mutedColor + '30' }}>
                  <PublicBlockRenderer
                    blocks={chrome.postBlocks}
                    branding={questionnaire}
                    doc={QUESTIONNAIRE_DOC}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <p className="mt-10 text-center" style={{ fontSize: `${theme.finePrintFontSize}px`, color: theme.mutedColor }}>
          Secured by Zebri ·{' '}
          <a href="https://zebri.com.au" className="hover:opacity-70">
            zebri.com.au
          </a>
        </p>
      </div>
    </div>
  )
}
