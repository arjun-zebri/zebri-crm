'use client';

/**
 * A suggested email scraped from the prospect's website. It is not used for
 * sending until the founder confirms it, so this is a question, not a
 * status. Confirming sends `confirm_email` to the server; the server flips
 * the flag and the email becomes eligible for sequences.
 *
 * @module features/outreach/views/prospects/found-email-suggestion
 */
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { updateProspectAction } from '@/features/outreach/actions';
import { useOutreachMutation } from '@/features/outreach/hooks';

/** Props for {@link FoundEmailSuggestion}. */
export interface FoundEmailSuggestionProps {
  prospectId: string;
}

/** "Found on their website. Not emailed until you confirm." with a button that confirms it. */
export function FoundEmailSuggestion({ prospectId }: FoundEmailSuggestionProps) {
  const confirm = useOutreachMutation(updateProspectAction, 'Email confirmed. It can be emailed now.');
  return (
    <Callout tone="info" icon={null}>
      <span className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1">Found on their website. Not emailed until you confirm.</span>
        <Button
          variant="outline"
          loading={confirm.isPending}
          disabled={confirm.isPending}
          onClick={() => confirm.mutate({ id: prospectId, patch: { confirm_email: true } })}
        >
          Use this email
        </Button>
      </span>
    </Callout>
  );
}
