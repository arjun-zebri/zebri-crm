import { DoneView } from '@/components/ui-v2/dialog-parts';
import { TextLink } from '@/components/ui-v2/text-link';

/**
 * What a Zebri AI window shows once the visitor has said yes (sent the
 * reply or the nudge): the house `DoneView` (a drawn check, what
 * happened, what happens next), and a way back to try it again.
 *
 * @module app/design-system/v2/pages/website/ai-done
 */

export interface AiDoneProps {
  title: string;
  detail: string;
  again: string;
  onAgain: () => void;
}

/** The done state. See {@link AiDoneProps}. */
export function AiDone({ title, detail, again, onAgain }: AiDoneProps) {
  return (
    <div className="flex min-h-80 flex-1 flex-col pb-10">
      <DoneView title={title} detail={detail} />
      <p className="text-center">
        <TextLink onClick={onAgain}>{again}</TextLink>
      </p>
    </div>
  );
}
