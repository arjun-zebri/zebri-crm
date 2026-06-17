'use client'

import { Upload, FileText, Trash2, Loader2, Download, Image } from 'lucide-react'
import { useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

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
function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    return <Image size={16} strokeWidth={1.5} className="text-text-muted" />
  }
  return <FileText size={16} strokeWidth={1.5} className="text-text-muted" />
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
}

export function FilesSection({ token, initialFiles }: FilesSectionProps) {
  const [files, setFiles] = useState<PortalFile[]>(initialFiles)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
        className={`block border-2 border-dashed rounded-card px-6 py-8 text-center cursor-pointer transition ${
          dragOver
            ? 'border-brand-fg bg-surface-emphasis'
            : uploading
              ? 'border-border opacity-60 pointer-events-none'
              : 'border-border hover:border-border-strong hover:bg-surface-muted'
        }`}
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
            <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-text-muted" />
            <p className="text-body text-text-muted">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={20} strokeWidth={1.5} className={dragOver ? 'text-brand-fg' : 'text-text-subtle'} />
            <p className="text-body text-text-muted">
              {dragOver ? 'Drop file here' : <>Drop a file here or <span className="hidden md:inline">click to upload</span><span className="md:hidden">tap to upload</span></>}
            </p>
            <p className="text-caption text-text-subtle">Up to 20 MB per file.</p>
          </div>
        )}
      </label>

      {/* File list */}
      {files.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 border border-border rounded-card px-4 py-3 bg-surface hover:bg-surface-muted transition"
            >
              {getFileIcon(file.name)}
              <div className="flex-1 min-w-0">
                <p className="text-body text-text truncate">{file.name}</p>
                {file.file_size && (
                  <p className="text-caption text-text-subtle">{formatSize(file.file_size)}</p>
                )}
              </div>
              <a
                href={file.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 text-text-subtle hover:text-text-muted transition cursor-pointer shrink-0"
                title="Download"
              >
                <Download size={16} strokeWidth={1.5} />
              </a>
              <button
                onClick={() => deleteFile(file.id)}
                className="p-2.5 text-text-subtle hover:text-danger transition cursor-pointer shrink-0"
                title="Remove"
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
