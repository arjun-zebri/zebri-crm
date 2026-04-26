'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, Trash2, Loader2, Download } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import type { PortalFile } from './page'

function anonSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
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
        className={`block border-2 border-dashed rounded-xl px-4 py-8 text-center cursor-pointer transition ${
          dragOver
            ? 'border-gray-400 bg-gray-50'
            : uploading
              ? 'border-gray-200 opacity-60 pointer-events-none'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
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
            <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-gray-400" />
            <p className="text-sm text-gray-400">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={20} strokeWidth={1.5} className="text-gray-400" />
            <p className="text-sm text-gray-500">Drop a file here or click to upload</p>
            <p className="text-xs text-gray-400">PDF, Word, images. Up to 20MB.</p>
          </div>
        )}
      </label>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2.5">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 border border-gray-200 rounded-xl px-5 py-3.5 bg-white"
            >
              <FileText size={16} strokeWidth={1.5} className="text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-base text-gray-900 truncate">{file.name}</p>
                {file.file_size && (
                  <p className="text-sm text-gray-500">{formatSize(file.file_size)}</p>
                )}
              </div>
              <a
                href={file.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-gray-400 hover:text-gray-600 transition cursor-pointer shrink-0"
                title="Download"
              >
                <Download size={16} strokeWidth={1.5} />
              </a>
              <button
                onClick={() => deleteFile(file.id)}
                className="p-1.5 text-gray-300 hover:text-red-400 transition cursor-pointer shrink-0"
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
