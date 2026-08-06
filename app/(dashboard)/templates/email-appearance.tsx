/**
 * Email-shell appearance control (template editor preview header).
 *
 * Lets the MC decide how the branded shell dresses their emails: show
 * or hide the logo header, align it left/centre, and toggle the
 * brand-colour accent bar. Preferences persist to `user_metadata`
 * (`email_shell_*` keys) so they apply to **every** send — manual,
 * automation, and test — via `buildPublicBranding`, keeping the
 * preview-equals-send guarantee.
 *
 * @module app/(dashboard)/templates/email-appearance
 */
'use client'

import * as Popover from '@radix-ui/react-popover'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlignCenter, AlignLeft, Settings2 } from 'lucide-react'

import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/toast'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { createClient } from '@/lib/supabase/client'

/** The shell settings the popover edits. */
export interface EmailShellPrefs {
  showLogo: boolean
  logoAlign: 'left' | 'center'
  showAccent: boolean
}

const KEY = ['email-shell-prefs'] as const

/**
 * Current shell prefs + a persisting setter. Fetched fresh client-side
 * (the server-rendered branding prop goes stale after an in-session
 * change); writes go to `user_metadata` with an optimistic cache set so
 * the preview updates instantly.
 */
export function useEmailShellPrefs(branding: PublicBranding | null | undefined) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<EmailShellPrefs> => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const meta = (user?.user_metadata ?? {}) as Record<string, unknown>
      return {
        showLogo: (meta['email_shell_show_logo'] as boolean | undefined) ?? true,
        logoAlign: meta['email_shell_logo_align'] === 'center' ? 'center' : 'left',
        showAccent: (meta['email_shell_show_accent'] as boolean | undefined) ?? true,
      }
    },
    // The server-resolved branding already carries the saved values, so
    // first paint is correct while the fresh read is in flight.
    initialData: {
      showLogo: branding?.email_show_logo ?? true,
      logoAlign: branding?.email_logo_align ?? 'left',
      showAccent: branding?.email_show_accent ?? true,
    },
  })

  const save = useMutation({
    mutationFn: async (next: EmailShellPrefs) => {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        data: {
          email_shell_show_logo: next.showLogo,
          email_shell_logo_align: next.logoAlign,
          email_shell_show_accent: next.showAccent,
        },
      })
      if (error) throw new Error(error.message)
    },
    onMutate: (next) => queryClient.setQueryData(KEY, next),
    onError: () => {
      toast('Could not save the email appearance', 'error')
      void queryClient.invalidateQueries({ queryKey: KEY })
    },
  })

  return { prefs: data, setPrefs: (next: EmailShellPrefs) => save.mutate(next) }
}

interface EmailAppearancePopoverProps {
  prefs: EmailShellPrefs
  onChange: (next: EmailShellPrefs) => void
}

/** Gear popover with the three shell switches. */
export function EmailAppearancePopover({ prefs, onChange }: EmailAppearancePopoverProps) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="Email appearance"
        title="Email appearance"
        className="inline-flex h-6 w-7 cursor-pointer items-center justify-center rounded-control text-text-subtle transition hover:text-text"
      >
        <Settings2 size={13} strokeWidth={1.5} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-[90] w-56 rounded-control border border-border bg-card p-3 shadow-lg animate-fade-in"
        >
          <div className="space-y-3">
            {/* Logo toggle + alignment share a row: the segmented
                icon control (same look as the device toggle) sits
                opposite the checkbox and only shows when relevant. */}
            <div className="flex h-6 items-center justify-between gap-2">
              <Checkbox
                checked={prefs.showLogo}
                onChange={(showLogo) => onChange({ ...prefs, showLogo })}
                label={<span className="text-caption text-text">Show logo</span>}
              />
              {prefs.showLogo && (
                <div className="flex items-center rounded-control bg-surface-muted p-0.5">
                  <button
                    type="button"
                    aria-label="Align logo left"
                    title="Align left"
                    onClick={() => onChange({ ...prefs, logoAlign: 'left' })}
                    className={`inline-flex h-5 w-6 cursor-pointer items-center justify-center rounded-control transition ${
                      prefs.logoAlign === 'left' ? 'bg-card text-text shadow-sm' : 'text-text-subtle hover:text-text'
                    }`}
                  >
                    <AlignLeft size={12} strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    aria-label="Align logo centre"
                    title="Align centre"
                    onClick={() => onChange({ ...prefs, logoAlign: 'center' })}
                    className={`inline-flex h-5 w-6 cursor-pointer items-center justify-center rounded-control transition ${
                      prefs.logoAlign === 'center' ? 'bg-card text-text shadow-sm' : 'text-text-subtle hover:text-text'
                    }`}
                  >
                    <AlignCenter size={12} strokeWidth={1.5} />
                  </button>
                </div>
              )}
            </div>
            <Checkbox
              checked={prefs.showAccent}
              onChange={(showAccent) => onChange({ ...prefs, showAccent })}
              label={<span className="text-caption text-text">Brand colour bar</span>}
            />
            <p className="text-xs text-text-subtle">Applies to every email you send.</p>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
