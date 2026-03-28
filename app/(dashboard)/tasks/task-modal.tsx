'use client'

import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { Modal } from '@/components/ui/modal'
import { DatePicker } from '@/components/ui/date-picker'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export interface TaskFormData {
  id?: string
  title: string
  due_date: string | null
  description: string | null
  related_couple_id?: string | null
}

interface TaskModalTask {
  id: string
  title: string
  due_date: string | null
  description?: string | null
  related_couple_id?: string | null
}

interface TaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: TaskFormData) => void
  onDelete?: (id: string) => void
  task?: TaskModalTask
  couples?: { id: string; name: string }[]
  loading: boolean
}

const inputClass =
  'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-green-300 focus:ring-2 focus:ring-green-100 transition'

export function TaskModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  task,
  couples,
  loading,
}: TaskModalProps) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  const [coupleId, setCoupleId] = useState<string>('')
  const [coupleOpen, setCoupleOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDueDate(task.due_date ?? '')
      setDescription(task.description ?? '')
      setCoupleId(task.related_couple_id ?? '')
    } else {
      setTitle('')
      setDueDate('')
      setDescription('')
      setCoupleId('')
    }
    setDeleteConfirm(false)
  }, [task, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onSave({
      id: task?.id,
      title: title.trim(),
      due_date: dueDate || null,
      description: description.trim() || null,
      ...(couples !== undefined ? { related_couple_id: coupleId || null } : {}),
    })
  }

  const selectedCouple = couples?.find((c) => c.id === coupleId)

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={task ? 'Edit Task' : 'New Task'}
        footer={
          <div className="flex items-center justify-between">
            {task && onDelete && (
              <button
                type="button"
                onClick={() => setDeleteConfirm(true)}
                disabled={loading}
                className="text-sm px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition disabled:opacity-50 cursor-pointer"
              >
                Delete
              </button>
            )}
            <div className="flex gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="text-sm px-4 py-2 rounded-xl bg-gray-100 text-gray-900 hover:bg-gray-200 transition disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !title.trim()}
                className="text-sm px-4 py-2 rounded-xl bg-black text-white hover:bg-neutral-800 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="What needs to be done?"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Due date</label>
            <DatePicker value={dueDate} onChange={setDueDate} placeholder="Select due date" />
          </div>

          {couples !== undefined && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Couple</label>
              <Popover.Root open={coupleOpen} onOpenChange={setCoupleOpen}>
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    className={`${inputClass} flex items-center justify-between text-left`}
                  >
                    <span className={selectedCouple ? 'text-gray-900' : 'text-gray-400'}>
                      {selectedCouple ? selectedCouple.name : 'No couple'}
                    </span>
                    <ChevronDown size={14} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-[70] w-[var(--radix-popover-trigger-width)] max-h-48 overflow-y-auto"
                    sideOffset={4}
                    align="start"
                  >
                    <button
                      type="button"
                      onClick={() => { setCoupleId(''); setCoupleOpen(false) }}
                      className={`w-full text-left px-3 py-2 text-sm transition ${
                        !coupleId ? 'bg-green-50 text-green-700' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      No couple
                    </button>
                    {couples.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setCoupleId(c.id); setCoupleOpen(false) }}
                        className={`w-full text-left px-3 py-2 text-sm transition ${
                          coupleId === c.id
                            ? 'bg-green-50 text-green-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} resize-none`}
              placeholder="Add any notes or details..."
              rows={5}
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteConfirm}
        title="Delete Task"
        description="Are you sure you want to delete this task? This cannot be undone."
        onConfirm={() => { if (task) onDelete?.(task.id) }}
        onCancel={() => setDeleteConfirm(false)}
        loading={loading}
      />
    </>
  )
}
