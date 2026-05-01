'use client'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
  confirmLabel?: string
  loadingLabel?: string
}

export function ConfirmDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  loading,
  confirmLabel = 'Delete',
  loadingLabel = 'Deleting...',
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-[70]"
        onClick={onCancel}
      />
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full">
          <div className="px-6 py-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-sm text-gray-500 mb-6">{description}</p>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={loading}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition cursor-pointer disabled:opacity-50"
              >
                {loading ? loadingLabel : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
