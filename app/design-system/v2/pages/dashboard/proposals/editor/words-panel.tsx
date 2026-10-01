import { Input } from '@/components/ui-v2/input';
import { Textarea } from '@/components/ui-v2/textarea';

/**
 * The proposal editor's Words tab: the welcome's heading and the note
 * under it, the two things a couple reads first and the two most MCs
 * rewrite. Both start from the template and greet the couple by name.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/editor/words-panel
 */

export interface WordsPanelProps {
  headline: string;
  onHeadline: (text: string) => void;
  welcome: string;
  onWelcome: (text: string) => void;
}

/** The Words tab. See {@link WordsPanelProps}. */
export function WordsPanel({ headline, onHeadline, welcome, onWelcome }: WordsPanelProps) {
  return (
    <div className="space-y-5">
      <Input label="Headline" maxLength={80} value={headline} onChange={(e) => onHeadline(e.target.value)} />
      <Textarea
        label="Welcome note"
        help="In your own voice. It sits beside your photo."
        rows={9}
        value={welcome}
        onChange={(e) => onWelcome(e.target.value)}
      />
    </div>
  );
}
