import type { CSSProperties } from 'react';

import { fontStack } from '../../onboarding/demo-data';
import { kitHexOf, type BrandKit } from '../brand/kit';

import { autoHeight, type BoxLook, type CanvasElement, type ColorRef, type TextLook } from './model';

/**
 * Turns an element's look into CSS, resolving kit references against the
 * brand kit. Every value here is the MC's own data, chosen at runtime
 * (a position, a size, a colour, a font), so it cannot be a Tailwind
 * class: the canvas is the one place in the app where styles are inline.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/resolve
 */

/** A colour reference as CSS: a kit colour's hex (the starting kit's when this kit lacks it), or the hex itself. */
export function colorOf(ref: ColorRef | null | undefined, kit: BrandKit): string | undefined {
  if (!ref) return undefined;
  if (ref.startsWith('kit:')) return kitHexOf(kit, ref.slice(4));
  return ref;
}

/** A text look as CSS, each unset value taken from its role's kit style. */
export function textCss(look: TextLook, kit: BrandKit): CSSProperties {
  const role = kit.text[look.role];
  const font = look.font ?? role.font;
  return {
    fontFamily: fontStack(font),
    fontSize: look.size ?? role.size,
    fontWeight: look.weight ?? role.weight,
    lineHeight: look.lineHeight ?? role.lineHeight,
    letterSpacing: `${look.letterSpacing ?? role.letterSpacing}em`,
    textTransform: (look.uppercase ?? role.uppercase) ? 'uppercase' : 'none',
    fontStyle: look.italic ? 'italic' : 'normal',
    textDecoration: look.underline ? 'underline' : 'none',
    textAlign: look.align ?? 'left',
    color: colorOf(look.color ?? 'kit:ink', kit),
  };
}

const SHADOW = { none: 'none', soft: '0 1px 3px rgb(0 0 0 / 0.08)', lifted: '0 12px 32px rgb(0 0 0 / 0.14)' } as const;

/** A box look as CSS. */
export function boxCss(box: BoxLook | undefined, kit: BrandKit): CSSProperties {
  if (!box) return {};
  const fill = colorOf(box.fill, kit);
  return {
    background:
      fill && box.gradient
        ? `linear-gradient(165deg, color-mix(in oklab, ${fill} 78%, white) 0%, ${fill} 40%, color-mix(in oklab, ${fill} 45%, black) 100%)`
        : fill,
    border: box.stroke ? `${box.strokeWidth ?? 1}px solid ${colorOf(box.stroke, kit)}` : undefined,
    borderRadius: box.radius,
    boxShadow: SHADOW[box.shadow ?? 'none'],
    opacity: box.opacity,
    padding: box.padding,
  };
}

/** Where an element sits on its page. */
export function frameCss(el: CanvasElement): CSSProperties {
  return {
    position: 'absolute',
    left: el.x,
    top: el.y,
    width: el.w,
    // A text's height is its words', measured back into `h` by the editor.
    height: autoHeight(el) ? undefined : el.h,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
  };
}
