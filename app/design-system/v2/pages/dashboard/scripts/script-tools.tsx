'use client';

import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ChevronDownIcon } from '@/components/ui-v2/icons';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import { Tooltip } from '@/components/ui-v2/tooltip';
import {
  SCRIPT_FONT_IDS,
  SCRIPT_FONT_LABELS,
  scriptFontStack,
  type ScriptFontId,
} from '@/lib/documents/script-fonts';

/**
 * The script toolbar's pieces: a button (`Tool`) that keeps the page's
 * selection when pressed, a quiet menu button (`ToolMenu`, shared with
 * the align and list menus), the face
 * menu (`FontMenu`, each face listed in itself so the MC sees what they
 * pick). Each is named by a styled tooltip (Button's own for a square
 * tool, `Tooltip` for one with words or a menu), never a native `title`.
 *
 * @module app/design-system/v2/pages/dashboard/scripts/script-tools
 */

/** A toolbar button: an icon, or an icon and words when the icon alone is unclear. */
export function Tool({
  label,
  text,
  on,
  disabled,
  onClick,
  children,
}: {
  label: string;
  /** Words beside the icon ("New page"); without them the button is square. */
  text?: string;
  on?: boolean | undefined;
  disabled?: boolean | undefined;
  onClick: () => void;
  children: ReactNode;
}) {
  const button = (
    <Button
      variant="ghost"
      square={!text}
      aria-label={text ? undefined : label}
      aria-pressed={on}
      active={on}
      disabled={disabled}
      compact={!!text}
      // Pressing keeps the page's selection, so the change lands on it.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
      {text}
    </Button>
  );
  // A square tool names itself from its aria-label; one with words needs a tooltip only when its label says more.
  return text && text !== label ? <Tooltip label={label}>{button}</Tooltip> : button;
}

/** Every toolbar icon's props. */
export const ICON = { 'aria-hidden': true, className: 'size-4' } as const;

/** A quiet button showing the current choice, opening a list of the others. */
export function ToolMenu({ name, current, children }: { name: string; current: ReactNode; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip label={name}>
        <PopoverTrigger asChild>
          <Button variant="ghost" compact className="gap-0.5" aria-label={name}>
            {current}
            {/* The compact chevron: the toolbar has to fit on one line. */}
            <ChevronDownIcon aria-hidden="true" className="size-3.5 text-zebra-500" />
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent size="menu" align="start" role="menu" aria-label={name} className="max-h-72 overflow-y-auto">
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}

/** The script's face. */
export function FontMenu({ font, onFont }: { font: ScriptFontId; onFont: (font: ScriptFontId) => void }) {
  // A face's own look: a value from the catalogue, which no class holds.
  const face = (id: ScriptFontId, cls?: string) => (
    <span className={cls} style={{ fontFamily: scriptFontStack(id) }}>
      {SCRIPT_FONT_LABELS[id]}
    </span>
  );
  return (
    // Capped, so a long face name never pushes the toolbar onto a second line.
    <ToolMenu name="Font" current={face(font, 'max-w-24 truncate')}>
      {(close) =>
        SCRIPT_FONT_IDS.map((id) => (
          <MenuOption key={id} selected={id === font} onSelect={() => (onFont(id), close())}>
            {face(id)}
          </MenuOption>
        ))
      }
    </ToolMenu>
  );
}
