'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { Swap } from '@/components/ui-v2/swap';

import { Group, Spec } from './showroom-v2';

/**
 * v2 motion: `Swap` handing a control over to its next state in place,
 * and `DrawnCheck` drawing itself as it arrives. Click Add, then Remove,
 * to replay the hand-over; the Blocks rows, detail footer and bundle all
 * use this pair.
 *
 * @module app/design-system/v2/components-motion
 */
export function ComponentsMotionV2() {
  const [added, setAdded] = useState(false);
  return (
    <Group id="motion" title="Motion">
      <Spec
        name="Swap"
        file="components/ui-v2/swap.tsx"
        description="One control's states in the same spot, handed over in place: the old one softens away, the new one settles in, and nothing around it shifts. Use it wherever a button becomes a status. Click Add, then Remove."
      >
        <div className="flex items-center gap-4">
          <Swap
            active={added ? 'added' : 'add'}
            className="justify-items-start"
            states={{
              add: <Button variant="secondary" onClick={() => setAdded(true)}>Add</Button>,
              added: (
                <Badge size="control" tone="brand">
                  <DrawnCheck className="size-3.5" />
                  Added
                </Badge>
              ),
            }}
          />
          <Swap
            active={added ? 'remove' : 'none'}
            states={{
              none: null,
              remove: <Button variant="ghost" onClick={() => setAdded(false)}>Remove</Button>,
            }}
          />
        </div>
      </Spec>
      <Spec
        name="Drawn check"
        file="components/ui-v2/drawn-check.tsx"
        description="A tick that draws itself at the moment something is done. Inside a Swap it only draws on the hand-over, never when a view opens."
      >
        <span className="flex items-center gap-2 type-body text-grass-800">
          {/* Keyed so the showroom replays the draw alongside the Swap above. */}
          <DrawnCheck key={String(added)} className="size-4" />
          Connected
        </span>
      </Spec>
    </Group>
  );
}
