'use client'

import * as Popover from '@radix-ui/react-popover'
import { type Editor } from '@tiptap/react'
import {
  AlignCenter, AlignLeft, AlignRight, Bold, ChevronDown, Highlighter,
  Image as ImageIcon, Italic, Link2, List, ListOrdered, Type, Underline,
} from 'lucide-react'
import { useRef, useState } from 'react'

import { ColorPopover } from '@/components/ui/color-popover'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'

/** A pickable value with a label and optional icon (dropdown menus). */
interface Option {
  value: string
  label: string
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number }>
}

// Web-safe families that survive across email clients. Each option
// previews in its own font in the dropdown.
const FONT_FAMILIES: Option[] = [
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: "'Helvetica Neue', Helvetica, sans-serif", label: 'Helvetica' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
  { value: 'Tahoma, Geneva, sans-serif', label: 'Tahoma' },
  { value: "'Trebuchet MS', Helvetica, sans-serif", label: 'Trebuchet MS' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: "'Times New Roman', Times, serif", label: 'Times New Roman' },
  { value: 'Garamond, serif', label: 'Garamond' },
  { value: "'Courier New', Courier, monospace", label: 'Courier New' },
  { value: "'Brush Script MT', cursive", label: 'Brush Script' },
]
const FONT_SIZES: Option[] = [
  { value: '13px', label: 'Small' },
  { value: '15px', label: 'Normal' },
  { value: '18px', label: 'Large' },
  { value: '24px', label: 'Huge' },
]
const ALIGNMENTS: Option[] = [
  { value: 'left', label: 'Left', icon: AlignLeft },
  { value: 'center', label: 'Center', icon: AlignCenter },
  { value: 'right', label: 'Right', icon: AlignRight },
]
const TEXT_COLOURS = ['#000000', '#6B7280', '#DC2626', '#EA580C', '#059669', '#0284C7', '#7C3AED', '#DB2777']
const HIGHLIGHTS = ['#FEF08A', '#FBBF24', '#FCA5A5', '#A7F3D0', '#93C5FD', '#D8B4FE']

/**
 * The signature editor toolbar: font, styling, colour, link, image,
 * alignment, and lists. Stateless beyond each control's own popover; all
 * edits route through the passed TipTap {@link Editor}.
 */
export function SignatureToolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50/50 flex-wrap">
      <MenuSelect
        title="Font family"
        options={FONT_FAMILIES}
        current={editor.getAttributes('textStyle').fontFamily}
        fallback="Font"
        onPick={(v) => editor.chain().focus().setFontFamily(v).run()}
        onClear={() => editor.chain().focus().unsetFontFamily().run()}
        leadingIcon={Type}
        previewFont
      />
      <MenuSelect
        title="Font size"
        options={FONT_SIZES}
        current={editor.getAttributes('textStyle').fontSize}
        fallback="Normal"
        onPick={(v) => editor.chain().focus().setFontSize(v).run()}
        onClear={() => editor.chain().focus().unsetFontSize().run()}
      />
      <Divider />
      <IconToggle onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><Bold size={16} strokeWidth={1.5} /></IconToggle>
      <IconToggle onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><Italic size={16} strokeWidth={1.5} /></IconToggle>
      <IconToggle onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline"><Underline size={16} strokeWidth={1.5} /></IconToggle>
      <ColorPopover
        value={editor.getAttributes('textStyle').color || '#000000'}
        // No `.focus()`: focusing the editor would move focus out of the
        // colour popover and Radix would dismiss it mid-pick. ProseMirror
        // applies the mark to the preserved selection without DOM focus.
        onChange={(c) => editor.chain().setColor(c).run()}
        swatches={TEXT_COLOURS}
        trigger={
          <button type="button" title="Text colour" className="flex items-center gap-1 px-2 py-1.5 rounded-md text-gray-700 hover:bg-gray-100 transition cursor-pointer">
            <span className="text-sm font-semibold leading-none">A</span>
            <span className="w-4 h-1.5 rounded-sm" style={{ backgroundColor: editor.getAttributes('textStyle').color || '#000000' }} />
          </button>
        }
      />
      <ColorPopover
        value={editor.getAttributes('highlight').color || '#FEF08A'}
        onChange={(c) => editor.chain().setHighlight({ color: c }).run()}
        swatches={HIGHLIGHTS}
        trigger={
          <button type="button" title="Highlight colour" className="flex items-center gap-1 px-2 py-1.5 rounded-md text-gray-700 hover:bg-gray-100 transition cursor-pointer">
            <Highlighter size={16} strokeWidth={1.5} />
            <span className="w-4 h-1.5 rounded-sm" style={{ backgroundColor: editor.getAttributes('highlight').color || '#FEF08A' }} />
          </button>
        }
      />
      <IconToggle onClick={() => editor.chain().focus().unsetHighlight().run()} title="Remove highlight"><span className="text-xs font-medium line-through">H</span></IconToggle>
      <Divider />
      <LinkControl editor={editor} />
      <ImageControl editor={editor} />
      <Divider />
      <MenuSelect
        title="Alignment"
        options={ALIGNMENTS}
        current={editor.getAttributes('paragraph').textAlign || 'left'}
        fallback="Left"
        iconOnly
        onPick={(v) => editor.chain().focus().setTextAlign(v).run()}
      />
      <IconToggle onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list"><List size={16} strokeWidth={1.5} /></IconToggle>
      <IconToggle onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list"><ListOrdered size={16} strokeWidth={1.5} /></IconToggle>
    </div>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 mx-1" />
}

/** A toggle icon button; highlights while its mark/block is active. */
function IconToggle({ onClick, active, title, disabled, children }: {
  onClick: () => void; active?: boolean; title: string; disabled?: boolean; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-md transition cursor-pointer ${
        disabled ? 'text-gray-300 cursor-not-allowed' : active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  )
}

/** Popover wrapper: a trigger button plus content that can self-close. */
function ToolbarPopover({ title, trigger, children }: {
  title?: string; trigger: React.ReactNode; children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" title={title} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm text-gray-700 hover:bg-gray-100 transition cursor-pointer">
          {trigger}
          <ChevronDown size={14} strokeWidth={1.5} className="text-gray-400 shrink-0" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-[70] bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[9rem]">
          {children(() => setOpen(false))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * A labelled dropdown of options, with an optional "Default" clear row.
 * With `previewFont`, each option renders in its own font value so the
 * font menu shows live previews.
 */
function MenuSelect({ title, options, current, fallback, onPick, onClear, leadingIcon: Leading, iconOnly, previewFont }: {
  title?: string; options: Option[]; current: string | undefined; fallback: string
  onPick: (value: string) => void; onClear?: () => void
  leadingIcon?: Option['icon']; iconOnly?: boolean; previewFont?: boolean
}) {
  const active = options.find((o) => o.value === current)
  const ActiveIcon = active?.icon
  const trigger = iconOnly && ActiveIcon
    ? <ActiveIcon size={16} strokeWidth={1.5} />
    : <>{Leading ? <Leading size={16} strokeWidth={1.5} /> : null}<span className="max-w-[90px] truncate font-medium">{active?.label ?? fallback}</span></>
  return (
    <ToolbarPopover title={title} trigger={trigger}>
      {(close) => (
        <>
          {options.map((o) => {
            const Icon = o.icon
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onPick(o.value); close() }}
                style={previewFont ? { fontFamily: o.value } : undefined}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 text-sm transition cursor-pointer ${current === o.value ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                {Icon ? <Icon size={14} strokeWidth={1.5} /> : null}
                {o.label}
              </button>
            )
          })}
          {onClear && (
            <button type="button" onClick={() => { onClear(); close() }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition cursor-pointer">Default</button>
          )}
        </>
      )}
    </ToolbarPopover>
  )
}

/**
 * Normalise a user-typed link target to an absolute URL. A bare host like
 * `test.com.au` becomes `https://test.com.au` (otherwise it resolves
 * relative to the app and points at zebri.com.au/test.com.au); an
 * email-looking value becomes a `mailto:` link.
 */
function normalizeUrl(raw: string): string {
  const t = raw.trim()
  if (/^(https?:|mailto:|tel:)/i.test(t)) return t
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return `mailto:${t}`
  return `https://${t}`
}

/** Link control: a URL field with Apply / Remove, prefilled from selection. */
function LinkControl({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const isActive = editor.isActive('link')

  const apply = () => {
    if (!url.trim()) return
    editor.chain().focus().extendMarkRange('link').setLink({ href: normalizeUrl(url) }).run()
    setOpen(false)
    setUrl('')
  }

  return (
    <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) setUrl(editor.getAttributes('link').href || '') }}>
      <Popover.Trigger asChild>
        <button type="button" title="Link" className={`p-1.5 rounded-md transition cursor-pointer ${isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          <Link2 size={16} strokeWidth={1.5} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-[70] bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-64">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && apply()}
            placeholder="https://example.com"
            autoFocus
            className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-transparent transition"
          />
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={apply} className="flex-1 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-800 transition cursor-pointer">Apply</button>
            {isActive && (
              <button type="button" onClick={() => { editor.chain().focus().unsetLink().run(); setOpen(false) }} className="flex-1 px-3 py-1.5 bg-red-50 text-red-700 text-sm rounded-md hover:bg-red-100 transition cursor-pointer">Remove</button>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Image control: upload to the public branding bucket, insert by URL. */
function ImageControl({ editor }: { editor: Editor }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const { toast } = useToast()

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) return toast('Please select an image file.', 'error')
    if (file.size > 2 * 1024 * 1024) return toast('Image must be under 2MB.', 'error')

    setUploading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast('Not signed in.', 'error'); return }

      // Unique path per image (no overwrite), under the public branding bucket
      // so email clients can fetch it.
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const path = `${session.user.id}/signature/${Date.now()}-${safeName}`
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/branding/${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
          'x-upsert': 'true',
          'Content-Type': file.type,
          'Cache-Control': 'max-age=3600',
        },
        body: await file.arrayBuffer(),
      })
      if (!res.ok) { toast(`Upload failed (${res.status})`, 'error'); return }

      const { data } = supabase.storage.from('branding').getPublicUrl(path)
      editor.chain().focus().setImage({ src: data.publicUrl, alt: file.name }).run()
      toast('Image added.', 'success')
    } catch {
      toast('Upload failed.', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      {/* Hidden file input is the standard way to open the OS image picker. */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = '' }}
      />
      <IconToggle onClick={() => fileInputRef.current?.click()} title="Add image" disabled={uploading}>
        {uploading
          ? <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          : <ImageIcon size={16} strokeWidth={1.5} />}
      </IconToggle>
    </>
  )
}
