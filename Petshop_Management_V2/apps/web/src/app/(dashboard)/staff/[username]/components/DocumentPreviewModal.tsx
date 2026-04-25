'use client'

import React from 'react'
import { X, Download } from 'lucide-react'
import { EmployeeDocument, DOCUMENT_TYPE_LABELS } from '@/lib/api/staff.api'


interface DocumentPreviewModalProps {
  document: EmployeeDocument
  onClose: () => void
}

export function DocumentPreviewModal({ document, onClose }: DocumentPreviewModalProps) {
  const isImage = document.mimeType.startsWith('image/')
  const isPDF = document.mimeType === 'application/pdf'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative flex h-[90vh] w-full max-w-5xl flex-col rounded-xl border border-border bg-background-secondary">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">{DOCUMENT_TYPE_LABELS[document.type]}</h3>
            <p className="text-sm text-foreground-muted">{document.fileName}</p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={document.fileUrl}
              download={document.fileName}
              className="btn-outline inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
            >
              <Download size={16} />
              Tải xuống
            </a>

            <button
              onClick={onClose}
              className="btn-outline inline-flex items-center justify-center rounded-lg p-2"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isImage ? (
            <div className="flex items-center justify-center">
              <img src={document.fileUrl}
                alt={document.fileName}
                className="max-h-[70vh] max-w-full rounded-lg object-contain" />
            </div>
          ) : isPDF ? (
            <iframe
              src={document.fileUrl}
              className="h-full w-full rounded-lg"
              title={document.fileName}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 text-6xl">📄</div>
              <p className="mb-2 text-lg text-foreground">Không thể xem trước</p>
              <p className="text-sm text-foreground-muted">Vui lòng tải xuống để xem tài liệu</p>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="border-t border-border px-6 py-4">
          <div className="flex flex-wrap gap-4 text-sm text-foreground-muted">
            <span>
              <strong className="text-foreground">Kích thước:</strong>{' '}
              {(document.fileSize / 1024).toFixed(1)} KB
            </span>
            <span>
              <strong className="text-foreground">Loại:</strong> {document.mimeType}
            </span>
            <span>
              <strong className="text-foreground">Tải lên:</strong>{' '}
              {new Date(document.uploadedAt).toLocaleString('vi-VN')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
