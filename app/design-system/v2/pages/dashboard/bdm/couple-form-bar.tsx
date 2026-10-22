import { Avatar } from '@/components/ui-v2/avatar';
import { Button } from '@/components/ui-v2/button';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { CheckIcon, CircleCheckIcon, UserIcon } from '@/components/ui-v2/icons';
import { ProgressBar } from '@/components/ui-v2/progress-bar';
import { TextLink } from '@/components/ui-v2/text-link';

import { useAccount } from '../account';

/**
 * The bar across the top of the couple's form: who it is from, as a
 * letterhead (their logo, else their initials, their name, and a way to
 * ask them something), and how it stands ("Saved" once they type, "Ready
 * to send" once nothing is missing). Below `lg` a thin line along its
 * bottom edge is the progress (it was a row of dashes, "very old school",
 * user 2026-10-15); from `lg` the rail of named parts is, and it goes.
 * "From your celebrant", anonymous, was the weakest line on the page
 * (user, 2026-10-15).
 *
 * @module app/design-system/v2/pages/dashboard/bdm/couple-form-bar
 */

export interface CoupleFormBarProps {
  /** The celebrant's name; empty when there is none to show. */
  from: string;
  /** Their email, for "Questions? Email Sophie". */
  email?: string | undefined;
  saved: boolean;
  ready: boolean;
  /** The part on screen and how many there are, for the progress line; none on the welcome page. */
  progress?: { at: number; total: number } | undefined;
  /** Demo only: fills in every answer, to test the way back to the paperwork. */
  onFill?: (() => void) | undefined;
}

/** The bar. See {@link CoupleFormBarProps}. */
export function CoupleFormBar({ from, email, saved, ready, progress, onFill }: CoupleFormBarProps) {
  const { brand } = useAccount();
  const first = from.split(/\s+/)[0] ?? '';
  return (
    <header className="relative shrink-0 border-b border-hairline bg-field px-4 py-2.5 sm:px-8 sm:py-3">
      <div className="flex min-h-10 items-center gap-3">
        {brand?.logoUrl ? (
          // A data URL from the celebrant's own file: next/image cannot take it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logoUrl} alt="" className="h-9 w-auto max-w-28 shrink-0 object-contain" />
        ) : from ? (
          <Avatar name={from} tone="soft" />
        ) : (
          <IconCircle icon={UserIcon} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate type-label text-zebra-950">{from || 'Your celebrant'}</p>
          {email ? (
            <p className="truncate type-body text-zebra-500">
              Questions?{' '}
              <TextLink href={`mailto:${email}`}>Email {first || 'them'}</TextLink>
            </p>
          ) : (
            <p className="hidden type-body text-zebra-500 sm:block">Marriage celebrant</p>
          )}
        </div>
        {/* Demo only (user, 2026-10-15): the live form has no such button. */}
        {onFill ? (
          <>
            {/* A quiet word on a phone, where a boxed button crowded the name out. */}
            <span className="sm:hidden">
              <Button variant="text" onClick={onFill}>
                Add details
              </Button>
            </span>
            <span className="hidden sm:inline-flex">
              <Button variant="secondary" onClick={onFill}>
                Add details
              </Button>
            </span>
          </>
        ) : null}
        <span role="status" className={`flex shrink-0 items-center gap-1.5 type-body ${ready ? 'text-grass-700' : 'text-zebra-500'}`}>
          {ready ? <CircleCheckIcon aria-hidden="true" className="size-4" /> : saved ? <CheckIcon aria-hidden="true" className="size-4" /> : null}
          {/* On a phone the tick says it; the words come back from sm. */}
          <span className="max-sm:sr-only">{ready ? 'Ready to send' : saved ? 'Saved' : null}</span>
        </span>
      </div>
      {progress ? (
        <div className="lg:hidden">
          <ProgressBar edge label={`Part ${progress.at + 1} of ${progress.total}`} value={progress.at + 1} max={progress.total} />
        </div>
      ) : null}
    </header>
  );
}
