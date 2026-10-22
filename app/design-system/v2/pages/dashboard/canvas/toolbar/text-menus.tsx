'use client';

import { MENU_LABEL } from '@/components/ui-v2/control-styles';
import { MenuOption } from '@/components/ui-v2/popover';

import { fontStack, FONTS } from '../../../onboarding/demo-data';
import { ROLES, type BrandKit } from '../../brand/kit';
import { ToolMenu } from '../../scripts/script-tools';
import type { TextRole } from '../model';

/**
 * The text toolbar's two menus: the text style (heading, subheading,
 * body, caption, each shown in its kit look, as Canva lists a brand's
 * text styles) and the face (the brand's own faces first, then every
 * face, each written in itself).
 *
 * @module app/design-system/v2/pages/dashboard/canvas/toolbar/text-menus
 */

/** The text style menu. Picking one hands the text back to that style. */
export function RoleMenu({ role, kit, onRole }: { role: TextRole; kit: BrandKit; onRole: (role: TextRole) => void }) {
  const label = ROLES.find((r) => r.role === role)?.label ?? role;
  return (
    <ToolMenu name="Text style" current={<span className="max-w-24 truncate">{label}</span>}>
      {(close) =>
        ROLES.map((r) => {
          const k = kit.text[r.role];
          return (
            <MenuOption key={r.role} selected={r.role === role} onSelect={() => (onRole(r.role), close())}>
              {/* Each style in its own kit look: values from the MC's kit, set inline. */}
              <span style={{ fontFamily: fontStack(k.font), fontSize: Math.min(k.size, 26), fontWeight: k.weight, textTransform: k.uppercase ? 'uppercase' : 'none', letterSpacing: `${k.letterSpacing}em` }}>
                {r.label}
              </span>
            </MenuOption>
          );
        })
      }
    </ToolMenu>
  );
}

/** The face menu: the kit's faces, then the rest of the catalogue. */
export function FaceMenu({ font, kit, onFont }: { font: string; kit: BrandKit; onFont: (font: string) => void }) {
  const brand = [...new Set(ROLES.map((r) => kit.text[r.role].font))];
  const rest = FONTS.filter((f) => !brand.includes(f));
  const face = (f: string, cls?: string) => (
    // A face's own look, from the catalogue: no class holds it.
    <span className={cls} style={{ fontFamily: fontStack(f) }}>
      {f}
    </span>
  );
  return (
    <ToolMenu name="Font" current={face(font, 'max-w-28 truncate')}>
      {(close) => (
        <>
          <p className={MENU_LABEL}>Brand fonts</p>
          {brand.map((f) => (
            <MenuOption key={f} selected={f === font} onSelect={() => (onFont(f), close())}>
              {face(f)}
            </MenuOption>
          ))}
          <p className={MENU_LABEL}>All fonts</p>
          {rest.map((f) => (
            <MenuOption key={f} selected={f === font} onSelect={() => (onFont(f), close())}>
              {face(f)}
            </MenuOption>
          ))}
        </>
      )}
    </ToolMenu>
  );
}
