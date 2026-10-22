import type { ReactNode } from 'react';

import { Badge } from '@/components/ui-v2/badge';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { CeremonyScriptIcon } from '@/components/ui-v2/icons';

import { ShotFrame } from './shot-frame';

/**
 * A ceremony script already written from the couple's questionnaire:
 * every answer they gave lands in place, tinted so the visitor sees
 * which words came from the couple and which are the celebrant's own.
 * Demo content.
 *
 * @module app/design-system/v2/pages/website/ai-script-shot
 */

/** One answer from the questionnaire, dropped into the script. */
function A({ children }: { children: ReactNode }) {
  return <span className="rounded-check bg-grass-100 px-1 text-grass-800">{children}</span>;
}

/** The script shot. */
export function ScriptShot() {
  return (
    <ShotFrame>
      <div className="flex items-center gap-3 border-b border-hairline px-5 py-4">
        <IconCircle icon={CeremonyScriptIcon} />
        <span className="min-w-0 flex-1 type-label text-zebra-950">Ceremony script</span>
        <Badge dot tone="grass">
          8 answers filled in
        </Badge>
      </div>
      <div className="space-y-4 px-6 py-6 type-lead text-zebra-700">
        <p>
          Welcome, everyone. We are here at <A>Centennial Park</A> to celebrate <A>Ella</A> and{' '}
          <A>Noah</A>, who met <A>on a ski trip to Jindabyne</A> and have been finishing each
          other’s sentences ever since.
        </p>
        <p>
          Noah’s brother, <A>Sam</A>, will now read <A>“Union” by Robert Fulghum</A>.
        </p>
        <p className="text-zebra-400">Ella, please repeat after me…</p>
      </div>
    </ShotFrame>
  );
}
