import { Spec } from './showroom-v2';
import { TYPE_SCALE } from './type-scale';

/**
 * v2 typography: each UI text element rendered in its real style,
 * with its size alongside.
 *
 * @module app/design-system/v2/foundations-type
 */
export function FoundationsTypeV2() {
  return (
    <Spec
      name="Typography"
      file="app/globals.css"
      description="Every text element uses one of these type-* roles, never a raw size or a weight override. Secondary text is quieter in colour (zebra-500, zebra-400), not smaller."
    >
      <div className="divide-y divide-zebra-950/5">
        {TYPE_SCALE.map((el) => (
          <div
            key={el.name}
            className="grid grid-cols-1 items-baseline gap-1 py-4 first:pt-0 last:pb-0 sm:grid-cols-[9rem_1fr_auto] sm:gap-6"
          >
            <p className="type-body text-zebra-500">{el.name}</p>
            <p className={`${el.cls} min-w-0`}>{el.sample}</p>
            <p className="type-code text-zebra-400">{el.spec}</p>
          </div>
        ))}
      </div>
    </Spec>
  );
}
