import { CallIcon, MessageTextIcon, NotificationsIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';

/**
 * The Zebri AI row's three features, as the founder named them
 * (2026-10-18): drafted replies, AI nudges, and video calls that update
 * the client. Each is a tab beside one live panel of the real product.
 *
 * @module app/design-system/v2/pages/website/ai-features
 */

export type AiFeatureId = 'replies' | 'nudges' | 'calls';

export interface AiFeature {
  id: AiFeatureId;
  icon: ZebriIcon;
  title: string;
  /** One word, for the phone's switcher. */
  short: string;
  /** What it does for the MC, in one line. */
  line: string;
}

export const AI_FEATURES: readonly AiFeature[] = [
  {
    id: 'replies',
    icon: MessageTextIcon,
    title: 'Replies drafted for you',
    short: 'Replies',
    line: 'Every DM and email answered in your words, checked against your calendar.',
  },
  {
    id: 'nudges',
    icon: NotificationsIcon,
    title: 'Nudges when couples go quiet',
    short: 'Nudges',
    line: 'Zebri spots a proposal going cold and has the follow-up written.',
  },
  {
    id: 'calls',
    icon: CallIcon,
    title: 'Calls that update the couple',
    short: 'Calls',
    line: 'Talk on a video call. Zebri updates their record when you say yes.',
  },
];
