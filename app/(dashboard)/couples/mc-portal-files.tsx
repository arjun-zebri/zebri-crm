'use client'

import { useState, useRef } from 'react'
import { FileText, Download, Trash2, Plus, Loader2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'

interface PortalFile {
  id: string
  name: string
  file_url: string
  file_size: number | null
  created_at: string
}

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function storagePathFromUrl(url: string): string {
  const marker = '/portal-files/'
  const idx = url.indexOf(marker)
  return idx >= 0 ? url.slice(idx + marker.length) : ''
}

function FileCard({ file, onDelete }: { file: PortalFile; onDelete: (id: string) => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="inline-flex flex-col w-[200px] border border-gray-200 rounded-xl px-4 py-2.5 hover:border-gray-300 hover:bg-gray-50/50 transition group/file">
      <div className="flex items-start gap-2.5 min-w-0">
        <FileText size={14} strokeWidth={1.5} className="text-gray-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
          {file.file_size && <p className="text-xs text-gray-400">{formatSize(file.file_size)}</p>}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Remove?</span>
            <button
              type="button"
              onClick={() => onDelete(file.id)}
              className="text-xs text-red-500 hover:text-red-600 transition cursor-pointer"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer"
            >
              No
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="opacity-0 group-hover/file:opacity-60 hover:!opacity-100 transition cursor-pointer text-gray-400 hover:text-red-400"
              title="Remove"
            >
              <Trash2 size={12} strokeWidth={1.5} />
            </button>
            <a
              href={file.file_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
              title="Download"
            >
              <Download size={12} strokeWidth={1.5} />
            </a>
          </>
        )}
      </div>
    </div>
  )
}

const MAX_FILE_SIZE = 20 * 1024 * 1024
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

export function McPortalFiles({ coupleId }: { coupleId: string }) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const { data: files = [], isLoading } = useQuery<PortalFile[]>({
    queryKey: ['portal-files', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_files')
        .select('*')
        .eq('couple_id', coupleId)
        .order('created_at')
      if (error) throw error
      return data || []
    },
  })

  const uploadFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) { toast('File must be under 20MB'); return }
    if (!ALLOWED_FILE_TYPES.includes(file.type)) { toast('File type not supported. Use PDF, JPG, PNG, or WebP.'); return }

    setUploading(true)
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      const path = `${coupleId}/${Date.now()}-${file.name}`
      const { data: storageData, error: storageError } = await supabase.storage
        .from('portal-files')
        .upload(path, file, { upsert: false })

      if (storageError) throw storageError

      const { data: urlData } = supabase.storage.from('portal-files').getPublicUrl(storageData.path)
      const { error: dbError } = await supabase.from('portal_files').insert({
        couple_id: coupleId,
        user_id: user.user.id,
        name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
      })
      if (dbError) throw dbError
      queryClient.invalidateQueries({ queryKey: ['portal-files', coupleId] })
    } catch {
      toast('Failed to upload file')
    }
    setUploading(false)
  }

  const deleteFile = async (id: string) => {
    const file = files.find((f) => f.id === id)
    if (!file) return
    try {
      const storagePath = storagePathFromUrl(file.file_url)
      const { error } = await supabase.from('portal_files').delete().eq('id', id)
      if (error) throw error
      if (storagePath) await supabase.storage.from('portal-files').remove([storagePath])
      queryClient.invalidateQueries({ queryKey: ['portal-files', coupleId] })
    } catch {
      toast('Failed to remove file')
    }
  }

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex flex-wrap gap-2">
          {[1, 2].map((i) => <div key={i} className="h-[80px] w-[200px] bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : files.length === 0 ? (
        <p className="text-sm text-gray-400 py-1">No files uploaded yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {files.map((file) => (
            <FileCard key={file.id} file={file} onDelete={deleteFile} />
          ))}
        </div>
      )}

      <div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file) await uploadFile(file)
            if (inputRef.current) inputRef.current.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition cursor-pointer disabled:opacity-50"
        >
          {uploading ? (
            <><Loader2 size={13} strokeWidth={1.5} className="animate-spin" />Uploading…</>
          ) : (
            <><Plus size={13} strokeWidth={1.5} />Add file</>
          )}
        </button>
      </div>
    </div>
  )
}
