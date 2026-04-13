'use client'

import React, { useState, useCallback } from 'react'
import { Upload, X, Check, Loader2 } from 'lucide-react'
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_ICONS, DocumentType } from '@/lib/api/staff.api'

interface DocumentUploadZoneProps {
  documentType: DocumentType
  onUpload: (file: File, type: DocumentType) => Promise<void>
  isUploading?: boolean
}

export function DocumentUploadZone({ documentType, onUpload, isUploading = false }: DocumentUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)

      const file = e.dataTransfer.files[0]
      if (file) {
        await onUpload(file, documentType)
      }
    },
    [documentType, onUpload],
  )

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        await onUpload(file, documentType)
      }
    },
    [documentType, onUpload],
  )

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative rounded-xl border-2 border-dashed p-6 text-center transition-all ${isDragOver
        ? 'border-primary-500 bg-primary-500/5'
        : 'border-border bg-background-tertiary/30 hover:border-border/80 hover:bg-background-tertiary/50'
        }`}
    >
      {isUploading ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-primary-500" />
          <p className="text-sm text-foreground-muted">Đang tải lên...</p>
        </div>
      ) : (
        <>
          <input
            type="file"
            id={`upload-${documentType}`}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleFileSelect}
            disabled={isUploading}
          />
          <label
            htmlFor={`upload-${documentType}`}
            className="flex cursor-pointer flex-col items-center"
          >
            <span className="mb-3 text-3xl">{DOCUMENT_TYPE_ICONS[documentType]}</span>
            <p className="mb-1 text-sm font-semibold text-foreground">{DOCUMENT_TYPE_LABELS[documentType]}</p>
            <p className="text-xs text-foreground-muted">Bấm để tải lên</p>
          </label>
        </>
      )}
    </div>
  )
}

interface QuickUploadGridProps {
  onUpload: (file: File, type: DocumentType) => Promise<void>
  uploadingTypes?: Set<DocumentType>
}

const QUICK_UPLOAD_TYPES: DocumentType[] = [
  'CCCD_FRONT',
  'CCCD_BACK',
  'APPLICATION',
  'CERTIFICATE',
  'CONTRACT',
  'OTHER',
]

export function QuickUploadGrid({ onUpload, uploadingTypes = new Set() }: QuickUploadGridProps) {
  return (
    <div className="card">
      <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-foreground">
        <Upload size={16} className="text-primary-500" />
        Tải lên nhanh
      </h3>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {QUICK_UPLOAD_TYPES.map((type) => (
          <DocumentUploadZone
            key={type}
            documentType={type}
            onUpload={onUpload}
            isUploading={uploadingTypes.has(type)}
          />
        ))}
      </div>
    </div>
  )
}
