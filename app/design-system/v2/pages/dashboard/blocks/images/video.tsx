import { DialogHeader } from '@/components/ui-v2/dialog-parts';
import { VideoIcon } from '@/components/ui-v2/icons';

import { AMELIA_JACK_CALLS } from '../../clients/profile/amelia-jack-calls';
import { CallUpdates } from '../../clients/profile/call-updates';

import { BlockImageFrame, SCENE_CARD, SCENE_WIDE } from './block-image-frame';

/**
 * Video calls product image: the window a call ends on, Amelia and
 * Jack's final numbers call with the changes Zebri heard on it, each
 * ready to apply to their record. The real `DialogHeader` and
 * `CallUpdates` (the Zebri AI band's Calls panel), laid out at 640 by
 * 360 and shown at 75%, bleeding off the foot. Replaces the mark and
 * bullets placeholder, the one Blocks card on the marketing site with
 * no product in it (2026-10-18 page review).
 *
 * @module app/design-system/v2/pages/dashboard/blocks/images/video
 */

const CALL = AMELIA_JACK_CALLS.next;
const none = () => undefined;

/** Video calls block image. */
export function VideoImage() {
  return (
    <BlockImageFrame alt="Amelia and Jack's final numbers call, ended, with the changes heard on it ready to apply to their record.">
      <div className={SCENE_WIDE}>
        <div className={`${SCENE_CARD} -bottom-6 left-10 right-10 top-6`}>
          <DialogHeader id="video-image" icon={VideoIcon} title={CALL.title} aside={`Amelia & Jack · ${AMELIA_JACK_CALLS.nextLength}`} closable={false} />
          <div className="px-6 pb-6">
            <CallUpdates updates={CALL.updates} decisions={{}} onDecide={none} quotes />
          </div>
        </div>
      </div>
    </BlockImageFrame>
  );
}
