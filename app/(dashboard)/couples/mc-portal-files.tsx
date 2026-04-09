'use client'

import { FileText, Download } from 'lucide-react'

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

interface McPortalFilesProps {
  files: PortalFile[]
}

export function McPortalFiles({ files }: McPortalFilesProps) {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
        <p className="text-sm text-gray-500">No files uploaded yet</p>
        <p className="text-sm text-gray-400">
          Files shared by the couple through the portal will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {files.map((file) => (
        <div key={file.id} className="flex items-center gap-3 border border-gray-200 rounded-xl px-5 py-3.5">
          <FileText size={16} strokeWidth={1.5} className="text-gray-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-base text-gray-900 truncate">{file.name}</p>
            {file.file_size && <p className="text-sm text-gray-500">{formatSize(file.file_size)}</p>}
          </div>
          <a
            href={file.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition cursor-pointer shrink-0"
          >
            <Download size={14} strokeWidth={1.5} />
            Download
          </a>
        </div>
      ))}
    </div>
  )
}
