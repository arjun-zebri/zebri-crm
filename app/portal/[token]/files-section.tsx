'use client'

import { createBrowserClient } from '@supabase/ssr'
import { Upload, FileText, Trash2, Loader2, Download, Image } from 'lucide-react'
import { useState, useRef } from 'react'

import { FONT_STACKS } from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { STATUS_COLORS } from '@/lib/branding/status-colors'
import { roleDefaults } from '@/lib/branding/type-defaults'

import type { PortalFile } from './page'

function anonSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}

/**
 * Returns the appropriate icon for a file based on its extension.
 */
function getFileIcon(filename: string, color: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    return <Image size={16} strokeWidth={1.5} style={{ color }} />
  }
  return <FileText size={16} strokeWidth={1.5} style={{ color }} />
}

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

interface FilesSectionProps {
  token: string
  initialFiles: PortalFile[]
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding
}

export function FilesSection({ token, initialFiles, branding }: FilesSectionProps) {
  const [files, setFiles] = useState<PortalFile[]>(initialFiles)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const bodyDefaults = roleDefaults(branding, 'body')
  const finePrintDefaults = roleDefaults(branding, 'finePrint')

  const uploadFile = async (file: File) => {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/portal/upload?token=${token}&type=file`, {
      method: 'POST',
      body: fd,
    })
    if (res.ok) {
      const { url, fileId, name } = await res.json()
      const newFile: PortalFile = {
        id: fileId,
        name: name,
        file_url: url,
        file_size: file.size,
        created_at: new Date().toISOString(),
      }
      setFiles((prev) => [...prev, newFile])
    }
    setUploading(false)
  }

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await uploadFile(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await uploadFile(file)
  }

  const deleteFile = async (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
    const supabase = anonSupabase()
    await supabase.rpc('delete_portal_file', { p_token: token, p_id: id })
  }

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className="block rounded-control px-6 py-8 text-center cursor-pointer transition border-2 border-dashed"
        style={{
          borderColor: dragOver ? branding.brand_color : branding.border_color,
          backgroundColor: dragOver ? `${branding.brand_color}10` : 'transparent',
          opacity: uploading ? 0.6 : 1,
          pointerEvents: uploading ? 'none' : 'auto',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          onChange={handleFileInput}
          disabled={uploading}
          className="hidden"
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={20} strokeWidth={1.5} className="animate-spin" style={{ color: finePrintDefaults.color }} />
            <p
              style={{
                fontSize: `${bodyDefaults.fontSize}px`,
                color: finePrintDefaults.color,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                fontWeight: bodyDefaults.fontWeight,
                lineHeight: bodyDefaults.lineHeight,
              }}
            >
              Uploading...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={20} strokeWidth={1.5} style={{ color: dragOver ? branding.brand_color : finePrintDefaults.color }} />
            <p
              style={{
                fontSize: `${bodyDefaults.fontSize}px`,
                color: finePrintDefaults.color,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                fontWeight: bodyDefaults.fontWeight,
                lineHeight: bodyDefaults.lineHeight,
              }}
            >
              {dragOver ? 'Drop file here' : <>Drop a file here or <span className="hidden md:inline">click to upload</span><span className="md:hidden">tap to upload</span></>}
            </p>
            <p
              style={{
                fontSize: `${finePrintDefaults.fontSize}px`,
                color: finePrintDefaults.color,
                fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                fontWeight: finePrintDefaults.fontWeight,
                lineHeight: finePrintDefaults.lineHeight,
              }}
            >
              Up to 20 MB per file.
            </p>
          </div>
        )}
      </label>

      {/* File list */}
      {files.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-control px-4 py-3 transition hover:opacity-80"
              style={{
                border: `1px solid ${branding.border_color}`,
                backgroundColor: branding.surface_color,
              }}
            >
              {getFileIcon(file.name, finePrintDefaults.color)}
              <div className="flex-1 min-w-0">
                <p
                  className="truncate"
                  style={{
                    fontSize: `${bodyDefaults.fontSize}px`,
                    color: bodyDefaults.color,
                    fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                    fontWeight: bodyDefaults.fontWeight,
                    lineHeight: bodyDefaults.lineHeight,
                  }}
                >
                  {file.name}
                </p>
                {file.file_size && (
                  <p
                    style={{
                      fontSize: `${finePrintDefaults.fontSize}px`,
                      color: finePrintDefaults.color,
                      fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                      fontWeight: finePrintDefaults.fontWeight,
                      lineHeight: finePrintDefaults.lineHeight,
                    }}
                  >
                    {formatSize(file.file_size)}
                  </p>
                )}
              </div>
              <a
                href={file.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 transition cursor-pointer shrink-0 hover:opacity-60"
                title="Download"
                style={{ color: finePrintDefaults.color }}
              >
                <Download size={16} strokeWidth={1.5} />
              </a>
              <button
                onClick={() => deleteFile(file.id)}
                className="p-2.5 transition cursor-pointer shrink-0 hover:opacity-60"
                title="Remove"
                style={{ color: finePrintDefaults.color }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = STATUS_COLORS.error }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = finePrintDefaults.color }}
              >
                <Trash2 size={16} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
