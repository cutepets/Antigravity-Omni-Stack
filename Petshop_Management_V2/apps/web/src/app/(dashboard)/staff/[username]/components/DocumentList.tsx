'use client'

import React, { useState } from 'react'
import { FileText, Trash2, Download, Eye, Calendar, Filter } from 'lucide-react'
import dayjs from 'dayjs'
import { EmployeeDocument, DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_ICONS, DocumentType } from '@/lib/api/staff.api'
import { confirmDialog } from '@/components/ui/confirmation-provider'

interface DocumentListProps {
  documents: EmployeeDocument[]
  canDelete?: boolean
  onDelete?: (docId: string) => Promise<void>
  onView: (doc: EmployeeDocument) => void
}

export function DocumentList({ documents, canDelete = false, onDelete, onView }: DocumentListProps) {
  const [filterType, setFilterType] = useState<DocumentType | 'ALL'>('ALL')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filteredDocs = filterType === 'ALL' ? documents : documents.filter((d) => d.type === filterType)

  const uniqueTypes = Array.from(new Set(documents.map((d) => d.type)))

  const handleDelete = async (docId: string) => {
    if (!canDelete || !onDelete) return
    const confirmed = await confirmDialog({
      title: 'Xóa tài liệu?',
      description: 'Tài liệu này sẽ bị xóa khỏi hồ sơ nhân viên.',
      confirmText: 'Xóa',
      variant: 'danger',
    })
    if (!confirmed) return

    setDeletingId(docId)
    try {
      await onDelete(docId)
    } finally {
      setDeletingId(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string) => {
    return dayjs(dateStr).format('DD/MM/YYYY HH:mm')
  }

  if (documents.length === 0) {
    return (
      <div className="card">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
            <FileText size={16} className="text-primary-500" />
            Danh sách tài liệu (0)
          </h3>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background-tertiary/30 py-12">
          <FileText size={48} className="mb-3 text-foreground-muted/50" />
          <p className="text-foreground-muted">Chưa có tài liệu nào</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
          <FileText size={16} className="text-primary-500" />
          Danh sách tài liệu ({documents.length})
        </h3>

        {uniqueTypes.length > 1 && (
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-foreground-muted" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as DocumentType | 'ALL')}
              className="rounded-lg border border-border bg-background-tertiary/50 px-3 py-1.5 text-sm text-foreground focus:border-primary-500 focus:outline-none"
            >
              <option value="ALL">Tất cả loại</option>
              {uniqueTypes.map((type) => (
                <option key={type} value={type}>
                  {DOCUMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {filteredDocs.map((doc) => (
          <div
            key={doc.id}
            className="group flex items-center justify-between rounded-xl border border-border bg-background-tertiary/30 p-4 transition-all hover:border-border/80 hover:bg-background-tertiary/50"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background text-2xl">
                {DOCUMENT_TYPE_ICONS[doc.type]}
              </div>

              <div>
                <p className="font-medium text-foreground">{DOCUMENT_TYPE_LABELS[doc.type]}</p>
                <p className="text-sm text-foreground-muted">{doc.fileName}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-foreground-muted/70">
                  <span>{formatFileSize(doc.fileSize)}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {formatDate(doc.uploadedAt)}
                  </span>
                  {doc.expiresAt && (
                    <>
                      <span>·</span>
                      <span className="text-amber-500">
                        Hết hạn: {dayjs(doc.expiresAt).format('DD/MM/YYYY')}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => onView(doc)}
                className="btn-outline inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
              >
                <Eye size={12} />
                Xem
              </button>

              <a
                href={doc.fileUrl}
                download={doc.fileName}
                className="btn-outline inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
              >
                <Download size={12} />
                Tải
              </a>

              {canDelete && onDelete && (
                <button
                  onClick={() => handleDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 transition-all hover:bg-red-500/20 disabled:opacity-50"
                >
                  <Trash2 size={12} />
                  {deletingId === doc.id ? 'Đang xóa...' : 'Xóa'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredDocs.length === 0 && filterType !== 'ALL' && (
        <div className="mt-4 text-center text-sm text-foreground-muted">
          Không có tài liệu nào thuộc loại {DOCUMENT_TYPE_LABELS[filterType]}
        </div>
      )}
    </div>
  )
}
